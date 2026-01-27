import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        const regexes = this.gatherRegexes();
        return regexes.some(regexObj => new RegExp(regexObj.regex, regexObj.flags).test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.nsfw;
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const dateCutoff = this.getVariable<number>("dateCutoffWeeks", 4);

        const userPosts = this.getPosts(history, { since: subWeeks(new Date(), dateCutoff) }).filter(post => post.nsfw && !post.url.startsWith("/r/"));
        if (userPosts.length === 0) {
            return false;
        }

        const distinctTitles = uniq(userPosts.map(post => post.title));

        const regexes = this.gatherRegexes();
        const matchedRegexes = regexes.filter(regexObj => distinctTitles.some(postTitle => new RegExp(regexObj.regex, regexObj.flags).test(postTitle)));

        const matchesNeeded = this.getVariable<number>("matchesNeeded", 4);

        if (matchedRegexes.length < matchesNeeded) {
            return false;
        }

        const regexesInOutput = this.getVariable<number>("regexesInOutput", 5);
        this.addHitReason(`User has ${matchedRegexes.length} bad post titles: ${matchedRegexes.slice(0, regexesInOutput).map(r => `\`${r.regex}\``).join(", ")}`);
        return true;
    }
}
