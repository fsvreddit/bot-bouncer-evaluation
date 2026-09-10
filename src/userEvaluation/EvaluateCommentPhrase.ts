import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { subDays } from "date-fns";
import { CommentV2 } from "@devvit/protos/types/devvit/reddit/v2alpha/commentv2.js";
import { uniq } from "lodash";

export class EvaluateCommentPhrase extends UserEvaluatorBase {
    override name = "Comment Phrase";
    override shortname = "commentphrase";

    public override banContentThreshold = 1;

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.getVariable<string[]>("phrases", []);

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in comment phrase: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Comment phrase regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const phrases = this.getVariable<string[]>("phrases", []);
        return uniq(phrases.map(phrase => ({
            evaluatorName: this.name,
            subName: this.shortname,
            regex: phrase,
        })));
    }

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.gatherRegexes().map(r => new RegExp(r.regex));
        return this.compiledRegexes;
    }

    private eligibleComment (comment: Comment | CommentV2): boolean {
        const maxCommentAgeInDays = this.getVariable<number>("maxcommentageindays", 30);

        if (comment.createdAt <= subDays(new Date(), maxCommentAgeInDays)) {
            return false;
        }

        return this.getCompiledRegexes().some(regex => regex.test(comment.body));
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.comment) {
            return false;
        }

        return this.eligibleComment(event.comment);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxAgeInDays = this.getVariable<number>("maxageindays", 60);
        const maxCommentKarma = this.getVariable<number>("maxcommentkarma", 100);
        return user.commentKarma < maxCommentKarma && user.createdAt > subDays(new Date(), maxAgeInDays);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_: UserExtended): boolean {
        const userComments = this.getComments();
        const matchingComments = userComments.filter(comment => this.eligibleComment(comment));
        if (matchingComments.length === 0) {
            return false;
        }

        const minNumberOfMatchingComments = this.getVariable<number>("minnumberofmatchingcomments", 1);
        if (matchingComments.length < minNumberOfMatchingComments) {
            return false;
        }

        const matchingComment = matchingComments[0];

        const matchedPhrase = this.getCompiledRegexes().find(regex => regex.test(matchingComment.body))?.source;

        if (!matchedPhrase) {
            // Impossible to reach this point.
            return false;
        }

        this.addHitReason(`Comment found matching regex: "${matchedPhrase}"`);
        return true;
    }
}
