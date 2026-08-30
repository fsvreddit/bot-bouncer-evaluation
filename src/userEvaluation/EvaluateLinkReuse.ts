import { Post, UserSocialLink } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { MAIN_APP_NAME } from "../constants.js";
import { addHours, subDays } from "date-fns";
import { getSocialLinksWithCache } from "../index.js";

export class EvaluateLinkReuse extends UserEvaluatorBase {
    override name = "Link Reuse Bot";
    override shortname = "linkreuse";

    override banContentThreshold = 1;

    private getLinkRegexes (): string[] {
        return this.getVariable<string[]>("linkRegexes", []);
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];

        const linkRegexes = this.getLinkRegexes();
        if (linkRegexes.length === 0) {
            results.push({ severity: "error", message: "No link regexes defined" });
        }

        for (const regex of linkRegexes) {
            try {
                const regexp = new RegExp(regex);
                if (regexp.test("")) {
                    results.push({ severity: "error", message: `Link regex in linkreuse matches empty string: ${regex}` });
                }
            } catch {
                results.push({ severity: "error", message: `Invalid link regex in linkreuse: ${regex}` });
            }
        }

        const socialLinkRegexes = this.getVariable<string[]>("socialLinkRegexes", []);
        if (socialLinkRegexes.length === 0) {
            results.push({ severity: "error", message: "No social link regexes defined" });
        }

        for (const regex of socialLinkRegexes) {
            try {
                const regexp = new RegExp(regex);
                if (regexp.test("")) {
                    results.push({ severity: "error", message: `Social link regex in linkreuse matches empty string: ${regex}` });
                }
            } catch {
                results.push({ severity: "error", message: `Invalid social link regex in linkreuse: ${regex}` });
            }
        }

        return results;
    }

    override preEvaluatePost (post: Post): boolean {
        const linkRegexes = this.getLinkRegexes();
        return linkRegexes.some(regex => new RegExp(regex).test(post.url))
            && !post.crosspostParentId;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await
    override async preEvaluateComment (_event: CommentCreate): Promise<boolean> {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.nsfw;
    }

    private async getDistinctUsersForLink (link: string): Promise<string[]> {
        const redis = this.context.appSlug === MAIN_APP_NAME ? this.context.redis.global : this.context.redis;
        const cacheKey = `bbe:linkreuse:distinctUsers:${link}`;
        const cachedResults = await redis.get(cacheKey);
        if (cachedResults !== undefined) {
            return JSON.parse(cachedResults) as string[];
        }

        const results = await this.context.reddit.searchPosts({
            query: `url:"${link}"`,
            sort: "new",
            limit: 100,
        }).all();

        const distinctUsers = Array.from(new Set(results.filter(post => post.url === link && post.authorName !== "[deleted]").map(post => post.authorName)));
        await redis.set(cacheKey, JSON.stringify(distinctUsers), { expiration: addHours(new Date(), 1) });
        return distinctUsers;
    }

    private async isEligibleUserForEvaluator (username: string, isSubject = false): Promise<boolean> {
        let socialLinks: UserSocialLink[];
        if (isSubject) {
            socialLinks = await this.getSocialLinks(username);
        } else {
            socialLinks = await getSocialLinksWithCache(username, this.context);
        }

        if (socialLinks.length === 0) {
            return false;
        }

        const socialLinkRegexes = this.getVariable<string[]>("socialLinkRegexes", []);

        return socialLinks.some(link => socialLinkRegexes.some(regex => new RegExp(regex).test(link.outboundUrl)));
    }

    override async evaluate (user: UserExtended): Promise<boolean> {
        const linkRegexes = this.getLinkRegexes();

        const requiredLinks = this.getVariable<number>("requiredLinks", 3);
        const reuseThreshold = this.getVariable<number>("reuseThreshold", 3);
        const daysToCheck = this.getVariable<number>("daysToCheck", 7);

        const matchingPosts = this.getPosts()
            .filter(post => post.createdAt > subDays(new Date(), daysToCheck) && linkRegexes.some(regex => new RegExp(regex).test(post.url)) && !post.crosspostParentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);

        if (matchingPosts.length < requiredLinks) {
            return false;
        }

        const distinctLinks = Array.from(new Set(matchingPosts.map(post => post.url)));

        const reuses = await Promise.all(distinctLinks.map(async (link) => {
            const distinctUsers = await this.getDistinctUsersForLink(link);
            return { link, distinctUsers };
        }));

        const reusedOverThreshold = reuses.filter(({ distinctUsers }) => distinctUsers.length >= reuseThreshold);
        if (reusedOverThreshold.length < requiredLinks) {
            return false;
        }

        if (!(await this.isEligibleUserForEvaluator(user.username, true))) {
            return false;
        }

        const eligibleUsers = new Map<string, boolean>();

        // Now we need to check if any of the distinct users are eligible for this evaluator
        const filteredReuses: { link: string; distinctUsers: string[] }[] = [];
        for (const { link, distinctUsers } of reusedOverThreshold) {
            const eligibleDistinctUsers: string[] = [];
            for (const username of distinctUsers) {
                if (username === user.username) {
                    eligibleDistinctUsers.push(username);
                    continue;
                }

                const isEligibleFromCache = eligibleUsers.get(username);
                if (isEligibleFromCache !== undefined) {
                    if (isEligibleFromCache) {
                        eligibleDistinctUsers.push(username);
                        continue;
                    } else {
                        const isEligible = await this.isEligibleUserForEvaluator(username);
                        eligibleUsers.set(username, isEligible);
                        if (isEligible) {
                            eligibleDistinctUsers.push(username);
                        }
                    }
                }
            }

            filteredReuses.push({ link, distinctUsers: eligibleDistinctUsers });
        }

        const filteredReusedOverThreshold = filteredReuses.filter(({ distinctUsers }) => distinctUsers.length >= reuseThreshold);
        if (filteredReusedOverThreshold.length < requiredLinks) {
            return false;
        }

        this.addHitReason({
            reason: `User has ${filteredReusedOverThreshold.length} links reused by at least ${reuseThreshold} distinct users`,
            details: filteredReusedOverThreshold.map(({ link, distinctUsers }) => ({
                key: link,
                value: `Also used by by: ${distinctUsers.filter(username => username !== user.username).map(username => `u/${username}`).join(", ")}`,
            })),
        });

        return true;
    }
}
