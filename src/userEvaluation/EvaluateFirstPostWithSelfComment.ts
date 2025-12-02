import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { subDays } from "date-fns";
import { UserExtended } from "../extendedDevvit.js";

export class EvaluateFirstPostWithSelfComment extends UserEvaluatorBase {
    override name = "First Post with Self Comment Bot";
    override shortname = "firstpostselfcomment";
    override canAutoBan = true;
    override banContentThreshold = 1;

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.author?.id) {
            return false;
        }
        return event.author.id === event.post?.authorId;
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
            return false;
        }

        const oldestPost = this.getPosts(history).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).shift();
        if (!oldestPost) {
            return false;
        }

        if (oldestPost.subredditName !== `u_${user.username}`) {
            return false;
        }

        if (oldestPost.createdAt < subDays(new Date(), 7)) {
            return false;
        }

        if (oldestPost.numberOfComments > 1) {
            return false;
        }

        const comments = this.getComments(history);

        if (!comments.some(comment => comment.postId === oldestPost.id && comment.authorId === oldestPost.authorId)) {
            return false;
        }

        return true;
    }
}
