import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { subWeeks } from "date-fns";
import { uniq } from "lodash";
import { parse } from "regjsparser";

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
        const problematicTitles = this.gatherRegexes().map(r => r.regex);

        if (problematicTitles.length === 0) {
            return false;
        }

        if (user.commentKarma > 1000 && user.linkKarma > 2000) {
            return false;
        }

        return true;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const userPosts = this.getPosts(history, { since: subWeeks(new Date(), 1) }).filter(post => post.isNsfw());
        if (userPosts.length === 0) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => new RegExp(r.regex, "u"));
        if (regexes.length === 0) {
            return false;
        }

        const distinctTitles = uniq(userPosts.map(post => post.title));

        const matchedBanRegexes = regexes.filter(title => distinctTitles.some(postTitle => title.test(postTitle)));
        if (matchedBanRegexes.length === 0) {
            return false;
        }

        for (const matchedBanRegex of matchedBanRegexes) {
            const matchedPost = userPosts.find(post => matchedBanRegex.test(post.title));
            this.addHitReason(`Post title "${matchedPost?.title}" matched bannable regex: \`${matchedBanRegex}\``);
            this.canAutoBan = true;
        }

        return true;
    }
}
