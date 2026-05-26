import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { subDays } from "date-fns";
import { isLinkId } from "@devvit/public-api/types/tid.js";

export class EvaluateTitleCopyBot extends UserEvaluatorBase {
    override name = "TitleCopyBot";
    override shortname = "titlecopy";
    override banContentThreshold = 5;

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.comment?.body || !event.post?.title) {
            return false;
        }

        if (event.comment.body.trim() === event.post.title.trim()) {
            return true;
        }

        const tlcOnly = this.getVariable<boolean>("tlcOnly", false);
        if (tlcOnly && !isLinkId(event.comment.parentId)) {
            return false;
        }

        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.createdAt > subDays(new Date(), this.getVariable<number>("maxAccountAgeDays", 180));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async evaluate (_: UserExtended): Promise<boolean> {
        const ignoredSubs = this.getVariable<string[]>("ignoredSubs", []);

        const comments = this.getComments().filter(comment => !ignoredSubs.includes(comment.subredditName));

        if (comments.some(comment => comment.body.includes("\n"))) {
            return false;
        }

        const tlcOnly = this.getVariable<boolean>("tlcOnly", false);
        if (tlcOnly && comments.some(comment => !isLinkId(comment.parentId))) {
            return false;
        }

        const commentsToCheck = this.getVariable<number>("numCommentsToCheck", 5);
        const mostRecentComments = comments.slice(0, commentsToCheck);
        if (mostRecentComments.length < commentsToCheck) {
            return false;
        }

        if (this.getPosts().length > 0) {
            return false;
        }

        for (const comment of mostRecentComments) {
            const post = await this.context.reddit.getPostById(comment.postId);
            if (comment.body.trim() !== post.title.trim()) {
                return false;
            }
        }

        this.addHitReason({
            reason: "User's recent comments copy the post title verbatim, with no other comments or posts.",
            details: mostRecentComments.map(comment => ({
                key: `Comment ${comment.id}`,
                value: comment.body.trim(),
            })),
        });
        return true;
    }
}
