import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import markdownEscape from "markdown-escape";
import { uniq } from "lodash";

export class EvaluateBadDisplayName extends UserEvaluatorBase {
    override name = "Bad Display Name Bot";
    override shortname = "baddisplayname";

    public override banContentThreshold = 0;

    private isBadDisplayName (displayName?: string) {
        if (!displayName) {
            return false;
        }

        const regexes = this.getVariable<string[]>("regexes", []);
        const matchedRegex = regexes.find(regex => new RegExp(regex, "u").test(displayName));
        if (matchedRegex) {
            this.addHitReason(`Display name matches regex: ${markdownEscape(matchedRegex)}`);
        }
        return matchedRegex !== undefined;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const regexes = this.getVariable<string[]>("regexes", []);
        return uniq(regexes.map(regex => ({
            evaluatorName: this.name,
            regex,
            flags: "u",
        })));
    }

    override validateVariables (): ValidationIssue[] {
        const regexes = this.gatherRegexes().map(r => r.regex);
        const results: ValidationIssue[] = [];
        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal, "u");
            } catch {
                results.push({ severity: "error", message: `Invalid regex in baddisplayname: ${regexVal}` });
                continue;
            }
            if (regex.test("")) {
                results.push({ severity: "error", message: `Display name regex is too greedy: ${regexVal}` });
            }
        }
        return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return true;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        if (!this.isBadDisplayName(user.displayName)) {
            return false;
        }

        return user.commentKarma < 100;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
