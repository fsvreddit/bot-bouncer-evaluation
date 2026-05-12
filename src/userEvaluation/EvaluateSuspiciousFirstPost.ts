import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { Post } from "@devvit/public-api";
import { subDays } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_: UserExtended): boolean {
        const comments = this.getComments();
        if (comments.length > 1) {
            return false;
        }

        const posts = this.getPosts({ omitRemoved: false });
        if (posts.length === 0) {
            return false;
        }

        if (posts.length > 1) {
            return false;
        }

        if (!posts.every(post => this.eligiblePost(post))) {
            return false;
        }

        if (comments.length > 0) {
            const commentDate = comments[0].createdAt;
            const postDate = posts[0].createdAt;
            if (commentDate > postDate) {
                return false;
            }
        }

        this.addHitReason(`Sole post in ${markdownEscape(posts[0].subredditName)}`);

        return true;
    }
}
