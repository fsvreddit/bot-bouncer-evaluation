import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import markdownEscape from "markdown-escape";

export class EvaluateBioText extends UserEvaluatorBase {
    override name = "Bio Text Bot";
    override shortname = "biotext";
    override banContentThreshold = 0;

    private bioText: string[] | undefined;

    private getBioText (): string[] {
        this.bioText ??= this.getVariable<string[]>("bantext", []);
        return this.bioText;
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.getVariable<string[]>("bantext", []);

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in biotext: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Bio Text regex is too greedy: ${regexVal}` });
            }
        }

        if (this.getVariable<string[]>("reporttext", []).length > 0) {
            results.push({ severity: "warning", message: "The reporttext variable is obsolete, and should be left empty." });
        }

        return results;
    }

    override getVariableOverrides (): Record<string, unknown> {
        const bannableBioText = this.getVariable<string[]>("bantext", []);
        const results: Record<string, unknown> = {};
        if (bannableBioText.some(r => Array.isArray(r))) {
            results.bantext = bannableBioText.flat();
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const bannableBioText = this.getVariable<string[]>("bantext", []);
        return bannableBioText.map(regex => ({
            evaluatorName: this.name,
            regex,
            flags: "u",
        }));
    }

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.getBioText().map(bio => new RegExp(bio, "u"));
        return this.compiledRegexes;
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.author?.description) {
            return false;
        }

        return this.getCompiledRegexes().some(regex => event.author?.description && regex.test(event.author.description));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        const bannableBioText = this.getBioText();

        return bannableBioText.length > 0;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        if (!user.userDescription) {
            return false;
        }

        if (user.commentKarma > 2000 && user.linkKarma > 2000) {
            return false;
        }

        return this.getCompiledRegexes().some(regex => user.userDescription && regex.test(user.userDescription));
    }

    override evaluate (user: UserExtended): boolean {
        const matchedRegex = this.getCompiledRegexes().find(regex => user.userDescription && regex.test(user.userDescription));

        if (matchedRegex) {
            this.canAutoBan = true;
            this.addHitReason(`Bio text matched regex: ${markdownEscape(matchedRegex.source)}`);
        } else {
            return false;
        }

        return user.nsfw || this.getPosts().some(post => post.isNsfw());
    }
}
