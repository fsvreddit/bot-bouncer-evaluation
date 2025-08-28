import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { Comment, Post } from "@devvit/public-api";
import { subDays } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "../types.js";
import markdownEscape from "markdown-escape";

export class EvaluateSuspiciousFirstPost extends UserEvaluatorBase {
    override name = "Suspicious First Post";
    override shortname = "suspiciousfirstpost";

    override banContentThreshold = 1;

    private subList () {
        return this.getVariable<string[]>("subreddits", []);
    }

    private eligiblePost (post: Post): boolean {
        if (!this.subList().includes(post.subredditName)) {
            return false;
        }

        const domain = domainFromUrl(post.url);
        return (domain === "i.redd.it" || domain === "v.redd.it")
            || post.url.startsWith("https://www.reddit.com/gallery/");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        return this.eligiblePost(post);
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxAgeInDays = this.getVariable<number>("maxageindays", 14);
        const maxCommentKarma = this.getVariable<number>("maxcommentkarma", 50);
        return user.createdAt > subDays(new Date(), maxAgeInDays) && user.commentKarma < maxCommentKarma;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const comments = this.getComments(history);
        if (comments.length > 1) {
            this.setReason("User has multiple comments.");
            return false;
        }

        const posts = this.getPosts(history, { omitRemoved: false });
        if (posts.length === 0) {
            this.setReason("User has no posts.");
            return false;
        }

        if (posts.length > 1) {
            this.setReason("User has multiple posts.");
            return false;
        }

        if (!posts.every(post => this.eligiblePost(post))) {
            this.setReason("User has missing or mismatching posts.");
            return false;
        }

        if (comments.length > 0) {
            const commentDate = comments[0].createdAt;
            const postDate = posts[0].createdAt;
            if (commentDate > postDate) {
                this.setReason("User has a comment after the post.");
                return false;
            }
        }

        this.addHitReason(`Sole post in ${markdownEscape(posts[0].subredditName)}`);

        return true;
    }
}
