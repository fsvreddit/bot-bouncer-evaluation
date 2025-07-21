import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "../types.js";
import markdownEscape from "markdown-escape";
import { subWeeks } from "date-fns";

export class EvaluatePostTitle extends UserEvaluatorBase {
    override name = "Bad Post Title Bot";
    override shortname = "posttitle";
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
                results.push(`Invalid regex in post title: ${regexVal}`);
                continue;
            }

            // if (regex.test("A")) {
            //     results.push(`Post title regex is too greedy: ${regexVal}`);
            // }
        }

        return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    private getTitles () {
        const bannableTitles = this.getVariable<string[]>("bantext", []);
        const reportableTitles = this.getVariable<string[]>("reporttext", []);
        return { bannableTitles, reportableTitles };
    }

    override preEvaluatePost (post: Post): boolean {
        const { bannableTitles, reportableTitles } = this.getTitles();
        const problematicTitles = [...bannableTitles, ...reportableTitles];
        return problematicTitles.some(title => new RegExp(title, "u").test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const { bannableTitles, reportableTitles } = this.getTitles();

        if (bannableTitles.length === 0 && reportableTitles.length === 0) {
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
            this.setReason("User has no NSFW posts");
            return false;
        }

        const { bannableTitles, reportableTitles } = this.getTitles();

        const matchedBanRegex = bannableTitles.find(title => userPosts.some(post => new RegExp(title, "u").test(post.title)));
        if (matchedBanRegex) {
            const matchedPost = userPosts.find(post => new RegExp(matchedBanRegex, "u").test(post.title));
            this.hitReason = `Post title "${matchedPost?.title}" matched bannable regex: ${markdownEscape(matchedBanRegex)}`;
            this.canAutoBan = true;
            return true;
        }

        const matchedReportRegex = reportableTitles.find(title => userPosts.some(post => new RegExp(title, "u").test(post.title)));
        if (matchedReportRegex) {
            const matchedPost = userPosts.find(post => new RegExp(matchedReportRegex, "u").test(post.title));
            this.hitReason = `Post title "${matchedPost?.title}" matched reportable regex: ${markdownEscape(matchedReportRegex)}`;
            this.canAutoBan = false;
            return true;
        }

        return false;
    }
}
