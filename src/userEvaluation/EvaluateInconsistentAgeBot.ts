import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { Comment, Post } from "@devvit/public-api";
import { UserExtended } from "../extendedDevvit.js";
import { compact, uniq } from "lodash";
import { subWeeks } from "date-fns";

export class EvaluateInconsistentAgeBot extends UserEvaluatorBase {
    override name = "Inconsistent Age Bot";
    override shortname = "inconsistentage";
    override banContentThreshold = 6;
    override canAutoBan = true;

    override gatherRegexes (): EvaluatorRegex[] {
        const regexes = this.getVariable<string[]>("ageregexes", []);
        return regexes.map(regex => ({
            evaluatorName: this.name,
            regex,
        }));
    }

    override validateVariables (): ValidationIssue[] {
        const regexes = this.gatherRegexes().map(r => r.regex);
        const results: ValidationIssue[] = [];

        for (const regexVal of regexes) {
            try {
                new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in inconsistentage: ${regexVal}` });
            }
        }

        return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_event: CommentCreate): boolean {
        return false;
    }

    private getAgeFromPostTitle (title: string, regexes: RegExp[]): number | undefined {
        for (const regex of regexes) {
            const match = title.match(regex);
            if (match) {
                return parseInt(match[1]);
            }
        }
    }

    override preEvaluatePost (post: Post): boolean {
        if (!post.isNsfw()) {
            return false;
        }

        const regexes = this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        return this.getAgeFromPostTitle(post.title, regexes) !== undefined;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.commentKarma < 50;
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        const nsfwPosts = this.getPosts(history, { since: subWeeks(new Date(), 2) })
            .filter(post => post.isNsfw() && !post.subredditName.toLowerCase().includes("roleplay") && !post.url.startsWith("/r/"));

        const contentThreshold = this.getVariable<number>("contentthreshold", 6);
        this.banContentThreshold = contentThreshold;

        if (nsfwPosts.length < 4) {
            this.setReason("User has not posted enough NSFW posts in the last 2 weeks");
            return false;
        }

        const regexes = this.gatherRegexes().map(r => new RegExp(r.regex, r.flags));
        const agesFound = uniq(compact(nsfwPosts.map(post => this.getAgeFromPostTitle(post.title, regexes))));

        if (agesFound.length < 3) {
            this.setReason(`User has not posted enough different ages in NSFW posts: ${agesFound.join(", ")}`);
            return false;
        }

        if (user.userDescription?.includes("shared") || user.userDescription?.includes("couple") || nsfwPosts.some(post => post.title.toLowerCase().includes("couple"))) {
            this.canAutoBan = false;
        }

        this.addHitReason(`Inconsistent Age Bot: Found ${agesFound.length} different ages in ${nsfwPosts.length} posts`);
        return true;
    }
}
