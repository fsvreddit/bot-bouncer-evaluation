import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "../extendedDevvit.js";
import markdownEscape from "markdown-escape";
import { uniq } from "lodash";

export class EvaluatePinnedPostTitles extends UserEvaluatorBase {
    override name = "Sticky Post Title Bot";
    override shortname = "pinnedpost";
    override banContentThreshold = 1;

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.gatherRegexes();

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal.regex, regexVal.flags);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in sticky post title: ${regexVal.regex}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Sticky post title regex is too greedy: ${regexVal.regex}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const bannableTitles = this.getVariable<string[]>("bantext", []);
        return uniq(bannableTitles.map(title => ({
            evaluatorName: this.name,
            regex: title,
            flags: "u",
        })));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        const domain = domainFromUrl(post.url);
        return domain === "reddit.com";
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxCommentKarma", 2000);
        const maxLinkKarma = this.getVariable<number>("maxLinkKarma", 5000);

        if (user.commentKarma > maxCommentKarma || user.linkKarma > maxLinkKarma) {
            return false;
        }
        return true;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const stickyPosts = this.getPosts(history).filter(post => post.stickied);
        if (stickyPosts.length === 0) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        const matchedBanRegex = regexes.find(regex => stickyPosts.some(post => regex.test(post.title)));
        if (matchedBanRegex) {
            const matchedPost = stickyPosts.find(post => matchedBanRegex.test(post.title));
            this.addHitReason(`Sticky post title "${matchedPost?.title}" matched regex: ${markdownEscape(matchedBanRegex.source)}`);
            this.canAutoBan = true;
            return true;
        }

        return false;
    }
}
