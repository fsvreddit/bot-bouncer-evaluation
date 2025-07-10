import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { addMinutes } from "date-fns";
import { UserExtended } from "../types.js";
import { CommentV2 } from "@devvit/protos/types/devvit/reddit/v2alpha/commentv2.js";

export class EvaluateProductBot extends UserEvaluatorBase {
    override name = "Product Bot";
    override shortname = "product";
    override canAutoBan = false;

    private eligibleComment (comment: Comment | CommentV2): boolean {
        if (!comment.body) {
            return false;
        }

        const commentRegex = /^\[.+\]\(https:\/\/.+\)$/;

        return commentRegex.test(comment.body);
    }

    private eligiblePost (post: Post): boolean {
        if (post.body && post.body !== "[deleted]") {
            return false;
        }

        const ignoredSubreddits = this.getVariable<string[]>("ignoredsubreddits", []);
        if (ignoredSubreddits.includes(post.subredditName)) {
            return false;
        }

        return !post.nsfw && post.url.startsWith("https://v.redd.it/");
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.comment) {
            return false;
        }

        return this.eligibleComment(event.comment);
    }

    override preEvaluatePost (post: Post): boolean {
        return this.eligiblePost(post);
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.commentKarma < 1000 && user.linkKarma < 1000;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const eligiblePosts = this.getPosts(history).filter(post => this.eligiblePost(post));
        if (eligiblePosts.length === 0) {
            return false;
        }

        const comments = this.getComments(history);

        const postsWithMatchingComment = eligiblePosts.filter(post => comments.some(comment => comment.parentId === post.id && this.eligibleComment(comment) && comment.createdAt < addMinutes(post.createdAt, 2)));
        const postsNeeded = this.getVariable("postsneeded", 10);

        if (postsWithMatchingComment.length < postsNeeded) {
            this.setReason("Not enough matching comments for eligible posts.");
            return false;
        }

        return true;
    }
}
