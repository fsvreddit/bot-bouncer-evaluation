import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
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

        const matchedRegexes = this.getCompiledRegexes().filter(regex => regex.test(displayName));
        if (matchedRegexes.length === 0) {
            return false;
        }

        this.addHitReason(`Display name matches regexes: ${matchedRegexes.map(r => `\`${r.source}\``).join(", ")}`);
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

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        return this.compiledRegexes;
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];

        let regexes: string[];
        try {
            regexes = this.gatherRegexes().map(r => r.regex);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            results.push({ severity: "error", message: `Invalid defined handles list: ${message}` });
            return results;
        }

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
            return false;
        }

        return user.commentKarma < 100;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended): boolean {
        return true;
    }
}
