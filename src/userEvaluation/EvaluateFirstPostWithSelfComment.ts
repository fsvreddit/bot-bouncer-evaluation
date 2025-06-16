import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { subDays } from "date-fns";
import { UserExtended } from "../types.js";

export class EvaluateFirstPostWithSelfComment extends UserEvaluatorBase {
    override name = "First Post with Self Comment Bot";
    override shortname = "firstpostselfcomment";
    override canAutoBan = true;
    override banContentThreshold = 1;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        return post.body !== undefined && post.body.length > 0;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxcommentkarma", 1);
        const maxLinkKarma = this.getVariable<number>("maxlinkkarma", 1);

        return user.commentKarma < maxCommentKarma
            && user.linkKarma < maxLinkKarma;
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        if (history.length >= 50) {
            this.setReason("User has too many posts or comments in history");
            return false;
        }

        const oldestPost = this.getPosts(history).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).shift();
        if (!oldestPost) {
            this.setReason("User has no posts");
            return false;
        }

        if (oldestPost.subredditName !== `u_${user.username}`) {
            this.setReason("User's first post is not direct to their profile");
            return false;
        }

        if (oldestPost.createdAt < subDays(new Date(), 7)) {
            this.setReason("User's first post is older than 7 days");
            return false;
        }

        if (oldestPost.numberOfComments > 1) {
            this.setReason("User's first post has more than one comment");
            return false;
        }

        const comments = this.getComments(history);

        if (!comments.some(comment => comment.postId === oldestPost.id && comment.authorId === oldestPost.authorId)) {
            this.setReason("User has not commented on their first post");
            return false;
        }

        return true;
    }
}
