import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { subWeeks } from "date-fns";
import { uniq } from "lodash";
import { parse } from "regjsparser";
import markdownEscape from "markdown-escape";

export class EvaluatePostTitleDefinedHandles extends UserEvaluatorBase {
    override name = "Bad Post Title Defined Handles Bot";
    override shortname = "posttitledefinedhandles";
    override banContentThreshold = 1;

    private getHandles (): string[] {
        const definedHandles = this.getModuleVariable<string>("substitutions", "definedhandles", "");
        if (!definedHandles) {
            return [];
        }

        const parsed = parse(definedHandles, "u");
        if (parsed.type !== "disjunction") {
            return [];
        }

        return parsed.body.map(part => part.raw);
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];

        let regexes: string[];
        try {
            regexes = this.gatherRegexes().map(r => r.regex);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            results.push({ severity: "error", message: `Invalid defined handles list: ${message}` });
            return results;
        }

        for (const regexVal of regexes) {
            try {
                new RegExp(regexVal, "u");
            } catch {
                results.push({ severity: "error", message: `Invalid regex in post title: ${regexVal}` });
                continue;
            }
        }

        const handles = this.getHandles();
        if (handles.some(handle => handle === "")) {
            results.push({ severity: "error", message: `Empty handle found in posttitledefinedhandles` });
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const prefix = this.getVariable<string>("prefix", "");
        const suffix = this.getVariable<string>("suffix", "");

        const handles = this.getHandles();

        const regexes = handles.map(handle => `${prefix}${handle}${suffix}`);

        return uniq(regexes.map(regex => ({
            evaluatorName: this.name,
            regex,
            flags: "u",
        })));
    }

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        return this.compiledRegexes;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        if (post.crosspostParentId) {
            return false;
        }
        return this.getCompiledRegexes().some(regex => regex.test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxCommentKarma", 2000);
        const maxLinkKarma = this.getVariable<number>("maxLinkKarma", 5000);

        if (user.commentKarma > maxCommentKarma && user.linkKarma > maxLinkKarma) {
            return false;
        }

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_: UserExtended): boolean {
        const userPosts = this.getPosts({ since: subWeeks(new Date(), 1) }).filter(post => post.isNsfw() && !post.crosspostParentId);
        if (userPosts.length === 0) {
            return false;
        }

        const regexes = this.getCompiledRegexes();
        if (regexes.length === 0) {
            return false;
        }

        const nonMatchingTitles = new Set<string>();

        for (const title of userPosts.map(post => post.title)) {
            if (nonMatchingTitles.has(title)) {
                continue;
            }

            const matchedRegex = regexes.find(r => r.test(title));
            if (!matchedRegex) {
                nonMatchingTitles.add(title);
                continue;
            }

            this.addHitReason(`Post title "${title}" matched bannable regex: ${markdownEscape(matchedRegex.source)}`);
            this.canAutoBan = true;
            return true;
        }

        return false;
    }
}
