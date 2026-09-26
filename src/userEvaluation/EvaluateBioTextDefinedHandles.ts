import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
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

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.gatherRegexes().map(r => new RegExp(r.regex, "u"));
        return this.compiledRegexes;
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        if (!event.author?.description) {
            return false;
        }

        return this.getCompiledRegexes().some(regex => event.author?.description && regex.test(event.author.description));
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
            try {
                new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in biotextdefinedhandles: ${regexVal}` });
                continue;
            }
        }

        const handles = this.getHandles();
        if (handles.some(handle => handle === "")) {
            results.push({ severity: "error", message: `Empty handle found in biotextdefinedhandles` });
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

        if (user.commentKarma > 2000 && user.linkKarma > 2000) {
            return false;
        }

        return this.getCompiledRegexes().some(regex => user.userDescription && regex.test(user.userDescription));
    }

    override evaluate (user: UserExtended): boolean {
        if (!user.userDescription) {
            return false;
        }

        const bannableBioTextFound = this.getCompiledRegexes().filter(regex => user.userDescription && regex.test(user.userDescription));
        if (bannableBioTextFound.length === 0) {
            return false;
        }

        this.canAutoBan = true;
        this.addHitReason(`Bio text matched regexes: ${bannableBioTextFound.map(regex => `\`${regex.source}\``).join(", ")}`);

        return user.nsfw || this.getPosts().some(post => post.isNsfw());
    }
}
