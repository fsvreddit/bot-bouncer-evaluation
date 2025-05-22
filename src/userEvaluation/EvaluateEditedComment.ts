import { Comment, Post } from "@devvit/public-api";
import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { subDays } from "date-fns";
import { UserExtended } from "../types.js";

export class EvaluateEditedComment extends UserEvaluatorBase {
    override name = "Comment Edit Bot";
    override shortname = "commentedit";
    override canAutoBan = false;

    private commentBodyMatches (body: string) {
        const commentBodyRegexes = this.getVariable<string[]>("regexes", []);
        const matchingRegex = commentBodyRegexes.find(regex => new RegExp(regex, "i").test(body));
        if (!matchingRegex) {
            return false;
        }

        this.hitReason = `Comment body matches regex: ${matchingRegex}`;
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluateCommentEdit (event: CommentUpdate): boolean {
        if (!event.comment) {
            return false;
        }
        return this.commentBodyMatches(event.comment.body);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxcommentkarma", 1);
        const maxLinkKarma = this.getVariable<number>("maxlinkkarma", 1);
        const minAgeInDays = this.getVariable<number>("minageindays", 7);

        return user.commentKarma < maxCommentKarma
            && user.linkKarma < maxLinkKarma
            && user.createdAt > subDays(new Date(), minAgeInDays);
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const commentMaxAgeInDays = this.getVariable<number>("commentmaxageindays", 7);

        const recentEditedComments = this.getComments(history, { since: subDays(new Date(), commentMaxAgeInDays), edited: true });

        if (recentEditedComments.length === 0) {
            this.setReason("User has not edited any recent comments");
            return false;
        }

        const commentsNeeded = this.getVariable("commentsneeded", 1);
        const matchedComments = recentEditedComments.filter(comment => this.commentBodyMatches(comment.body));
        if (matchedComments.length < commentsNeeded) {
            this.hitReason = `User has edited ${recentEditedComments.length} comments, but only ${matchedComments.length} match the regex`;
            return false;
        }
        return true;
    }
}
