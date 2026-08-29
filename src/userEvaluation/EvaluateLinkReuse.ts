import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { MAIN_APP_NAME } from "../constants.js";
import { addHours, subDays } from "date-fns";
import pluralize from "pluralize";

export class EvaluateLinkReuse extends UserEvaluatorBase {
    override name = "Link Reuse Bot";
    override shortname = "linkreuse";

    override banContentThreshold = 1;

    private getLinkRegexes (): string[] {
        return this.getVariable<string[]>("linkRegexes", []);
    }

    override validateVariables (): ValidationIssue[] {
        const linkRegexes = this.getLinkRegexes();
        const results: ValidationIssue[] = [];

        for (const regex of linkRegexes) {
            try {
                new RegExp(regex);
            } catch {
                results.push({ severity: "error", message: `Invalid link regex in linkreuse: ${regex}` });
            }
        }

        return results;
    }

    override preEvaluatePost (post: Post): boolean {
        const linkRegexes = this.getLinkRegexes();
        return linkRegexes.some(regex => new RegExp(regex).test(post.url));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_event: CommentCreate): boolean {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const nsfwOnly = this.getVariable<boolean>("nsfwOnly", false);
        if (nsfwOnly && !user.nsfw) {
            return false;
        }

        return true;
    }

    private async getDistinctUsersForLink (link: string): Promise<string[]> {
        const redis = this.context.appSlug === MAIN_APP_NAME ? this.context.redis.global : this.context.redis;
        const cacheKey = `bbe:linkreuse:distinctUsers:${link}`;
        const cachedCount = await redis.get(cacheKey);
        if (cachedCount !== undefined) {
            return JSON.parse(cachedCount) as string[];
        }

        const results = await this.context.reddit.searchPosts({
            query: `url:"${link}"`,
            sort: "new",
            limit: 100,
        }).all();

        const distinctUsers = Array.from(new Set(results.filter(post => post.url === link && post.authorName !== "[deleted]").map(post => post.authorName)));
        await redis.set(cacheKey, JSON.stringify(distinctUsers), { expiration: addHours(new Date(), 6) });
        return distinctUsers;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async evaluate (_user: UserExtended): Promise<boolean> {
        const linkPrefixes = this.getLinkRegexes();

        const requiredLinks = this.getVariable<number>("requiredLinks", 3);
        const reuseThreshold = this.getVariable<number>("reuseThreshold", 3);
        const daysToCheck = this.getVariable<number>("daysToCheck", 7);

        const matchingPosts = this.getPosts()
            .filter(post => post.createdAt > subDays(new Date(), daysToCheck) && linkPrefixes.some(regex => new RegExp(regex).test(post.url)) && !post.crosspostParentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);

        if (matchingPosts.length < requiredLinks) {
            return false;
        }

        const distinctLinks = Array.from(new Set(matchingPosts.map(post => post.url)));

        const reuseCounts = await Promise.all(distinctLinks.map(async (link) => {
            const distinctUsers = await this.getDistinctUsersForLink(link);
            return { link, distinctUsers };
        }));

        const reusedOverThreshold = reuseCounts.filter(({ distinctUsers }) => distinctUsers.length >= reuseThreshold);
        if (reusedOverThreshold.length < requiredLinks) {
            return false;
        }

        this.addHitReason({
            reason: `User has ${reusedOverThreshold.length} links reused by at least ${reuseThreshold} distinct users`,
            details: reusedOverThreshold.map(({ link, distinctUsers }) => ({
                key: link,
                value: `Reused by ${distinctUsers.length} ${pluralize("user", distinctUsers.length)}: ${distinctUsers.map(user => `u/${user}`).join(", ")}`,
            })),
        });

        return true;
    }
}
