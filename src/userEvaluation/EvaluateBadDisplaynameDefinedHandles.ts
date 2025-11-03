import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { uniq } from "lodash";
import { parse } from "regjsparser";

export class EvaluateBadDisplayNameDefinedHandles extends UserEvaluatorBase {
    override name = "Bad Display Name Defined Handle Bot";
    override shortname = "baddisplaynamedefinedhandles";

    public override banContentThreshold = 0;

    private isBadDisplayName (displayName?: string): boolean {
        if (!displayName) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => r.regex);
        const matchedRegexes = regexes.filter(regex => new RegExp(regex, "u").test(displayName));
        if (matchedRegexes.length === 0) {
            return false;
        }

        this.addHitReason(`Display name matches regexes: ${matchedRegexes.map(r => `\`${r}\``).join(", ")}`);
        return true;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const prefix = this.getVariable<string>("prefix", "");
        const suffix = this.getVariable<string>("suffix", "");

        const definedHandles = this.getModuleVariable<string>("substitutions", "definedhandles", "");
        if (!definedHandles) {
            return [];
        }

        const parsed = parse(definedHandles, "u");
        if (parsed.type !== "disjunction") {
            return [];
        }

        const regexes = parsed.body.map(part => `${prefix}${part.raw}${suffix}`);

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
                results.push({ severity: "error", message: `Invalid regex in baddisplaynamedefinedhandles: ${regexVal}` });
                continue;
            }
            if (regex.test("")) {
                results.push({ severity: "error", message: `Display name defined handle regex is too greedy: ${regexVal}` });
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
            this.setReason("Display name does not match regexes");
            return false;
        }

        return user.commentKarma < 100;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
