import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { subWeeks } from "date-fns";
import { uniq } from "lodash";
import { parse } from "regjsparser";
import markdownEscape from "markdown-escape";

export class EvaluatePostTitleDefinedHandles extends UserEvaluatorBase {
    override name = "Bad Post Title Defined Handles Bot";
    override shortname = "posttitledefinedhandles";
    override banContentThreshold = 1;

    override validateVariables (): ValidationIssue[] {
        const regexes = this.gatherRegexes().map(r => r.regex);
        const results: ValidationIssue[] = [];

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal, "u");
            } catch {
                results.push({ severity: "error", message: `Invalid regex in post title: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Post title regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const prefix = this.getVariable<string>("prefix", "");
        const suffix = this.getVariable<string>("suffix", "");

        const definedHandles = this.getModuleVariable<string>("substitutions", "definedhandles", "");
        if (!definedHandles) {
            return [];
        }

        const parsed = parse(definedHandles, "u");
        if (parsed.type !== "disjunction") {
            return [];
        }

        const regexes = parsed.body.map(part => `${prefix}${part.raw}${suffix}`);

        return uniq(regexes.map(regex => ({
            evaluatorName: this.name,
            regex,
            flags: "u",
        })));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        const problematicTitles = this.gatherRegexes().map(r => r.regex);
        return problematicTitles.some(title => new RegExp(title, "u").test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxCommentKarma", 2000);
        const maxLinkKarma = this.getVariable<number>("maxLinkKarma", 5000);

        if (user.commentKarma > maxCommentKarma && user.linkKarma > maxLinkKarma) {
            return false;
        }

        return true;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const userPosts = this.getPosts(history, { since: subWeeks(new Date(), 1) }).filter(post => post.isNsfw() && !post.url.startsWith("/r/"));
        if (userPosts.length === 0) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => ({ pattern: r.regex, regex: new RegExp(r.regex, r.flags) }));
        if (regexes.length === 0) {
            return false;
        }

        const nonMatchingTitles = new Set<string>();

        for (const title of userPosts.map(post => post.title)) {
            if (nonMatchingTitles.has(title)) {
                continue;
            }

            const matchedRegex = regexes.find(r => r.regex.test(title));
            if (!matchedRegex) {
                nonMatchingTitles.add(title);
                continue;
            }

            this.addHitReason(`Post title "${title}" matched bannable regex: ${markdownEscape(matchedRegex.pattern)}`);
            this.canAutoBan = true;
            return true;
        }

        return false;
    }
}
