import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "../types.js";
import markdownEscape from "markdown-escape";

export class EvaluatePinnedPostTitles extends UserEvaluatorBase {
    override name = "Sticky Post Title Bot";
    override shortname = "pinnedpost";
    override banContentThreshold = 1;

    override validateVariables (): string[] {
        const results: string[] = [];
        const regexes = [
            ...this.getVariable<string[]>("bantext", []),
            ...this.getVariable<string[]>("reporttext", []),
        ];

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push(`Invalid regex in sticky post title: ${regexVal}`);
                continue;
            }

            if (regex.test("")) {
                results.push(`Sticky post title regex is too greedy: ${regexVal}`);
            }
        }

        return results;
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
        const bannableTitles = this.getVariable<string[]>("bantext", []);
        const reportableTitles = this.getVariable<string[]>("reporttext", []);

        if (bannableTitles.length === 0 && reportableTitles.length === 0) {
            return false;
        }

        if (user.commentKarma > 2000 || user.linkKarma > 2000) {
            return false;
        }
        return true;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const stickyPosts = this.getPosts(history).filter(post => post.stickied);
        if (stickyPosts.length === 0) {
            this.setReason("User has no sticky posts");
            return false;
        }

        const bannableTitles = this.getVariable<string[]>("bantext", []);
        const matchedBanRegex = bannableTitles.find(title => stickyPosts.some(post => new RegExp(title, "u").test(post.title)));
        if (matchedBanRegex) {
            const matchedPost = stickyPosts.find(post => new RegExp(matchedBanRegex, "u").test(post.title));
            this.addHitReason(`Sticky post title "${matchedPost?.title}" matched regex: ${markdownEscape(matchedBanRegex)}`);
            this.canAutoBan = true;
            return true;
        }

        const reportableTitles = this.getVariable<string[]>("reporttext", []);
        const matchedReportRegex = reportableTitles.find(title => stickyPosts.some(post => new RegExp(title, "u").test(post.title)));
        if (matchedReportRegex) {
            const matchedPost = stickyPosts.find(post => new RegExp(matchedReportRegex, "u").test(post.title));
            this.addHitReason(`Sticky post title "${matchedPost?.title}" matched regex: ${markdownEscape(matchedReportRegex)}`);
            this.canAutoBan = false;
            return true;
        }

        return false;
    }
}
