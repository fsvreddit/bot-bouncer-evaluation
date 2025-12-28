import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { uniq } from "lodash";
import { isModerator } from "devvit-helpers";

export class EvaluateWarmupBot extends UserEvaluatorBase {
    override name = "Warmup Bot";
    override shortname = "warmupbot";
    override banContentThreshold = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override validateVariables (): ValidationIssue[] {
        const regexes = this.gatherRegexes().map(r => r.regex);
        const results: ValidationIssue[] = [];

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid rege: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const subredditRegexes = this.getVariable<string[]>("subredditRegexes", []);
        const postTitleRegexes = this.getVariable<string[]>("postTitleRegexes", []);
        return [...subredditRegexes, ...postTitleRegexes].map(regex => ({
            evaluatorName: this.name,
            regex,
        }));
    }

    override preEvaluatePost (post: Post): boolean {
        const postTitleRegexes = this.getVariable<string[]>("postTitleRegexes", []);
        if (postTitleRegexes.length === 0) {
            return false;
        }

        return postTitleRegexes.some(regex => new RegExp(regex).test(post.title));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.isModerator;
    }

    override async evaluate (user: UserExtended, history: (Post | Comment)[]): Promise<boolean> {
        const subredditRegexes = this.getVariable<string[]>("subredditRegexes", []);

        if (subredditRegexes.length === 0) {
            return false;
        }

        const postTitleRegexes = this.getVariable<string[]>("postTitleRegexes", []);
        if (postTitleRegexes.length === 0) {
            return false;
        }

        const userPosts = this.getPosts(history);

        if (!userPosts.some(post => postTitleRegexes.some(regex => new RegExp(regex).test(post.title)))) {
            return false;
        }

        const userSubreddits = uniq(history.map(item => item.subredditName));
        const matchedSubreddits = userSubreddits.filter(subreddit => subredditRegexes.some(regex => new RegExp(regex).test(subreddit)));

        if (matchedSubreddits.length === 0) {
            return false;
        }

        // Check to see if the user is a mod of any of the matched subreddits
        let moddedSubreddit: string | undefined;
        for (const subreddit of matchedSubreddits) {
            if (await isModerator(this.context.reddit, subreddit, user.username)) {
                moddedSubreddit = subreddit;
                break;
            }
        }

        if (!moddedSubreddit) {
            return false;
        }

        this.addHitReason(`User is a moderator of matched subreddit: ${moddedSubreddit}`);
        return true;
    }
}
