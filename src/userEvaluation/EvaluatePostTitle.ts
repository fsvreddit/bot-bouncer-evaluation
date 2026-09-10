import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import markdownEscape from "markdown-escape";
import { subWeeks } from "date-fns";
import { uniq } from "lodash";

export class EvaluatePostTitle extends UserEvaluatorBase {
    override name = "Bad Post Title Bot";
    override shortname = "posttitle";
    override banContentThreshold = 1;

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = this.gatherRegexes().map(r => r.regex);

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal, "u");
            } catch {
                results.push({ severity: "error", message: `Invalid regex in post title: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Post title regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const bannableTitles = this.getTitles();
        return uniq(bannableTitles.map(title => ({
            evaluatorName: this.name,
            regex: title,
            flags: "u",
        })));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    private getTitles () {
        return this.getVariable<string[]>("bantext", []);
    }

    private titleRegexes: RegExp[] | undefined;
    private getTitleRegexes (): RegExp[] {
        this.titleRegexes ??= this.getTitles().map(title => new RegExp(title, "u"));
        return this.titleRegexes;
    }

    override preEvaluatePost (post: Post): boolean {
        if (post.crosspostParentId) {
            return false;
        }

        return this.getTitleRegexes().some(title => title.test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxCommentKarma = this.getVariable<number>("maxCommentKarma", 2000);
        const maxLinkKarma = this.getVariable<number>("maxLinkKarma", 5000);

        if (user.commentKarma > maxCommentKarma && user.linkKarma > maxLinkKarma) {
            return false;
        }

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_: UserExtended): boolean {
        const userPosts = this.getPosts({ since: subWeeks(new Date(), 1) }).filter(post => post.nsfw && !post.crosspostParentId);
        if (userPosts.length === 0) {
            return false;
        }

        const nonMatchingTitles = new Set<string>();
        const regexes = this.getTitleRegexes();

        for (const title of userPosts.map(post => post.title)) {
            if (nonMatchingTitles.has(title)) {
                continue;
            }

            let matchedBanRegex: RegExp | undefined;
            if (this.verboseLogging) {
                matchedBanRegex = regexes.find((regex) => {
                    const start = Date.now();
                    const result = regex.test(title);
                    const end = Date.now();
                    if (end - start > this.regexWarnThreshold) {
                        console.warn(`Evaluation: Regex took ${end - start}ms: ${regex.source}`);
                    }
                    return result;
                });
            } else {
                matchedBanRegex = regexes.find(regex => regex.test(title));
            }

            if (!matchedBanRegex) {
                nonMatchingTitles.add(title);
                continue;
            }

            this.addHitReason(`Post title "${title}" matched bannable regex: ${markdownEscape(matchedBanRegex.source)}`);
            this.canAutoBan = true;
            return true;
        }

        return false;
    }
}
