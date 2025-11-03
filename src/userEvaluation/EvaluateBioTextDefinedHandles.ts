import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { uniq } from "lodash";
import { parse } from "regjsparser";

export class EvaluateBioTextDefinedHandles extends UserEvaluatorBase {
    override name = "Bio Text Defined Handle Bot";
    override shortname = "biotextdefinedhandles";
    override banContentThreshold = 0;

    private getHandles (): string[] {
        const definedHandles = this.getModuleVariable<string>("substitutions", "definedhandles", "");
        if (!definedHandles) {
            return [];
        }

        const parsed = parse(definedHandles, "u");
        if (parsed.type !== "disjunction") {
            return [];
        }

        return parsed.body.map(part => part.raw);
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        const problematicBioText = this.gatherRegexes().map(r => r.regex);

        return problematicBioText.some(bioText => event.author?.description && new RegExp(bioText, "u").test(event.author.description));
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.gatherRegexes().map(r => r.regex);

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in biotextdefinedhandles: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Bio Text Defined Handles regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const prefix = this.getVariable<string>("prefix", "");
        const suffix = this.getVariable<string>("suffix", "");
        const handles = this.getHandles();
        return uniq(handles.map(handle => ({
            evaluatorName: this.name,
            regex: `${prefix}${handle}${suffix}`,
            flags: "u",
        })));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return this.getHandles().length > 0;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        if (!user.userDescription) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => r.regex);

        if (regexes.length === 0) {
            return false;
        }

        if (user.commentKarma > 2000 && user.linkKarma > 2000) {
            return false;
        }

        return regexes.some(bioText => user.userDescription && new RegExp(bioText, "u").test(user.userDescription));
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        if (!user.userDescription) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => r.regex);

        if (regexes.length === 0) {
            return false;
        }

        const bannableBioTextFound = regexes.filter(bio => user.userDescription && new RegExp(bio, "u").test(user.userDescription));
        if (bannableBioTextFound.length === 0) {
            return false;
        }

        this.canAutoBan = true;
        this.addHitReason(`Bio text matched regexes: ${bannableBioTextFound.map(bio => `\`${bio}\``).join(", ")}`);

        return user.nsfw || this.getPosts(history).some(post => post.isNsfw());
    }
}
