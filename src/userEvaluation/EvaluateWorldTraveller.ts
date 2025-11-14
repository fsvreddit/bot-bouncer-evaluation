import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { CONTROL_SUBREDDIT } from "../constants.js";
import { UserExtended } from "../extendedDevvit.js";
import { uniq } from "lodash";
import { subMonths } from "date-fns";

interface SubGroup {
    group: string;
    subs: string[];
}

export class EvaluateWorldTraveller extends UserEvaluatorBase {
    override name = "World Traveller";
    override shortname = "worldtraveler";

    override canAutoBan = true;
    override banContentThreshold = 10;

    override validateVariables (): ValidationIssue[] {
        const subGroups = this.getWTSubGroups();
        const results: ValidationIssue[] = [];

        const allSubs = new Set<string>();
        const duplicateSubs = new Set<string>();

        for (const group of subGroups) {
            for (const sub of group.subs) {
                if (allSubs.has(sub)) {
                    duplicateSubs.add(sub);
                } else {
                    allSubs.add(sub);
                }
            }
        }

        if (duplicateSubs.size > 0) {
            results.push({
                severity: "warning",
                message: `Subreddits found in more than one group: ${Array.from(duplicateSubs).join(", ")}`,
            });
        }

        return results;
    }

    private getWTSubGroups (): SubGroup[] {
        const subGroups = this.getVariable<string[]>("subgroups", []);
        return subGroups.map(group => ({ group, subs: group.split(",").map(s => s.trim()) }));
    }

    private getSubList (): string[] {
        return this.getWTSubGroups().map(group => group.subs).flat();
    }

    private isInEligibleSubreddit (): boolean {
        if (!this.context.subredditName) {
            return false;
        }
        return this.context.subredditName === CONTROL_SUBREDDIT || this.getSubList().includes(this.context.subredditName);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return this.isInEligibleSubreddit();
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.nsfw && this.isInEligibleSubreddit();
    }

    override evaluate (_: UserExtended, history: (Post | Comment)[]): boolean {
        const nsfwOnly = this.getVariable<boolean>("nsfwonly", false);
        const relevantHistory = this.getPosts(history, { since: subMonths(new Date(), 1) })
            .filter(post => nsfwOnly ? post.nsfw : true)
            .filter(post => this.getSubList().includes(post.subredditName));

        const distinctSubreddits = uniq(relevantHistory.map(item => item.subredditName));

        const distinctSubGroups = uniq(this.getWTSubGroups()
            .filter(group => distinctSubreddits.some(sub => group.subs.includes(sub)))
            .map(group => group.group));

        const requiredSubCount = this.getVariable<number>("distinctgroups", 5);

        return distinctSubGroups.length >= requiredSubCount;
    }
}
