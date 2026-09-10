import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { subWeeks } from "date-fns";
import { uniq } from "lodash";

export class EvaluatePostTitleMulti extends UserEvaluatorBase {
    override name = "Bad Post Title Multi Bot";
    override shortname = "posttitlemulti";
    override banContentThreshold = 1;

    override validateVariables (): ValidationIssue[] {
        const regexes = this.gatherRegexes();
        const results: ValidationIssue[] = [];

        for (const regexObj of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexObj.regex, regexObj.flags);
            } catch {
                results.push({ severity: "error", message: `Invalid regex: ${regexObj.regex}` });
                continue;
            }

            if (!regexObj.regex.startsWith("^")) {
                results.push({ severity: "warning", message: `Regex must be anchored to start with \`^\`: ${regexObj.regex}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Regex is too greedy: ${regexObj.regex}` });
            }
        }

        return results;
    }

    override getVariableOverrides (): Record<string, unknown> {
        const regexes = this.getVariable<(string | string[])[]>("regexes", []);
        if (regexes.some(r => Array.isArray(r))) {
            return {
                regexes: regexes.flat(),
            };
        } else {
            return {};
        }
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const bannableTitles = this.getVariable<string[]>("regexes", []);
        return bannableTitles.map(title => ({
            evaluatorName: this.name,
            regex: title,
            flags: "u",
        }));
    }

    private compiledRegexes: RegExp[] | undefined;
    private getCompiledRegexes (): RegExp[] {
        this.compiledRegexes ??= this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        return this.compiledRegexes;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        if (post.crosspostParentId) {
            return false;
        }
        const regexes = this.getCompiledRegexes();
        return regexes.some(regex => regex.test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.nsfw;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_: UserExtended): boolean {
        const dateCutoff = this.getVariable<number>("dateCutoffWeeks", 4);

        const userPosts = this.getPosts({ since: subWeeks(new Date(), dateCutoff) }).filter(post => post.nsfw && !post.crosspostParentId);
        if (userPosts.length === 0) {
            return false;
        }

        const distinctTitles = uniq(userPosts.map(post => post.title));

        const regexes = this.getCompiledRegexes();
        const matchedRegexes = regexes.filter(regex => distinctTitles.some(postTitle => regex.test(postTitle)));

        const matchesNeeded = this.getVariable<number>("matchesNeeded", 4);

        if (matchedRegexes.length < matchesNeeded) {
            return false;
        }

        const regexesInOutput = this.getVariable<number>("regexesInOutput", 5);
        this.addHitReason(`User has ${matchedRegexes.length} bad post titles: ${matchedRegexes.slice(0, regexesInOutput).map(r => `\`${r.source}\``).join(", ")}`);
        return true;
    }
}
