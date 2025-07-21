import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "../types.js";
import { subMonths, subWeeks } from "date-fns";

export class EvaluateTGGroup extends UserEvaluatorBase {
    override name = "Telegram Group Bot";
    override shortname = "tg-group";
    override banContentThreshold = 1;

    override validateVariables (): string[] {
        const results: string[] = [];
        const regexes = this.getVariable<string[]>("bodyregex", []);

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push(`Invalid regex in TG Group: ${regexVal}`);
                continue;
            }

            if (regex.test("")) {
                results.push(`TG Group regex is too greedy: ${regexVal}`);
            }
        }

        return results;
    }

    private eligiblePost (post: Post): boolean {
        if (!post.body) {
            return false;
        }

        const titleStrings = this.getVariable<string[]>("titlestrings", []);
        const bodyRegexes = this.getVariable<string[]>("bodyregex", []);
        return post.nsfw
            && titleStrings.some(titleString => post.title.includes(titleString))
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            && bodyRegexes.some(bodyRegex => new RegExp(bodyRegex).test(post.body!));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        return this.eligiblePost(post);
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.createdAt > subMonths(new Date(), 1)
            || user.commentKarma < 100
            || user.linkKarma < 50;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const recentPosts = this.getPosts(history, { since: subWeeks(new Date(), 1) }).filter(post => post.nsfw);
        if (recentPosts.length === 0) {
            this.setReason("User has no NSFW posts");
            return false;
        }

        return recentPosts.some(post => this.eligiblePost(post));
    }
}
