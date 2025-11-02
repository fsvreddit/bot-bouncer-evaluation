import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { subWeeks } from "date-fns";
import { UserExtended } from "../extendedDevvit.js";
import markdownEscape from "markdown-escape";
import { uniq } from "lodash";

export class EvaluateBadUsername extends UserEvaluatorBase {
    override name = "Bad Username Bot";
    override shortname = "badusername";

    public override banContentThreshold = 0;

    private isBadUsername (username?: string) {
        if (!username) {
            return false;
        }

        const regexes = this.getVariable<string[]>("regexes", []);
        const matchedRegex = regexes.find(regex => new RegExp(regex).test(username));
        if (matchedRegex) {
            this.addHitReason(`Username matches regex: ${markdownEscape(matchedRegex)}`);
        }
        return matchedRegex !== undefined;
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.getVariable<string[]>("regexes", []);
        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in badusername: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Bad username regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const regexes = this.getVariable<string[]>("regexes", []);
        return uniq(regexes.map(regex => ({
            evaluatorName: this.name,
            regex,
        })));
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        return this.isBadUsername(event.author?.name);
    }

    override preEvaluatePost (post: Post): boolean {
        return this.isBadUsername(post.authorName);
    }

    override preEvaluateUser (user: UserExtended): boolean {
        if (!this.isBadUsername(user.username)) {
            this.setReason("Username does not match regexes");
            return false;
        }

        const maxAgeWeeks = this.getVariable<number>("maxageweeks", 4);
        if (user.createdAt < subWeeks(new Date(), maxAgeWeeks)) {
            this.setReason("Account is too old");
            return false;
        }

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
