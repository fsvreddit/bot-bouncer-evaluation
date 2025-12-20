import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { subMonths, subYears } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "../extendedDevvit.js";
import { uniq } from "lodash";

export class EvaluateSocialLinks extends UserEvaluatorBase {
    override name = "Social Links Bot";
    override shortname = "sociallinks";

    override banContentThreshold = 0;

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const badLinks = this.getVariable<string[]>("badlinks", []);
        for (const link of badLinks) {
            try {
                domainFromUrl(link);
            } catch {
                results.push({ severity: "error", message: `Invalid URL in badlinks: ${link}` });
            }
        }
        return results;
    }

    override getVariableOverrides (): Record<string, unknown> {
        const badLinks = this.getVariable<(string | string[])[]>("badlinks", []);
        if (badLinks.some(link => Array.isArray(link))) {
            return {
                badlinks: badLinks.flat(),
            };
        } else {
            return {};
        }
    }

    private getDomains (): string[] {
        const domains = new Set<string>(this.getGenericVariable<string[]>("redditdomains", []));
        domains.add("redgifs.com");
        domains.add("instagram.com");
        domains.add("i.redd.it");

        const badLinks = this.getVariable<string[]>("badlinks", []);
        for (const link of badLinks) {
            try {
                const domain = domainFromUrl(link);
                if (domain) {
                    domains.add(domain);
                }
            } catch {
                //
            }
        }

        return Array.from(domains);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        if (this.socialLinks) {
            const badSocialLinks = this.getVariable<string[]>("badlinks", []);
            return this.socialLinks.some(link => badSocialLinks.some(badLink => link.outboundUrl.startsWith(badLink)));
        }
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        const postDomain = domainFromUrl(post.url);

        return postDomain !== undefined && (this.getDomains().includes(postDomain));
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const badSocialLinks = this.getVariable<string[]>("badlinks", []);
        if (badSocialLinks.length === 0) {
            return false;
        }

        const accountEligible = (user.commentKarma < 500 && user.createdAt > subMonths(new Date(), 2))
            || user.createdAt < subYears(new Date(), 5)
            || user.nsfw;

        return accountEligible;
    }

    override async evaluate (user: UserExtended, history: (Post | Comment)[]): Promise<boolean> {
        const badSocialLinks = this.getVariable<string[]>("badlinks", []);
        if (badSocialLinks.length === 0) {
            return false;
        }

        const badLinksFromPosts = badSocialLinks.filter(badLink => this.getPosts(history).some(post => post.url.startsWith(badLink)));
        if (badLinksFromPosts.length > 0) {
            this.addHitReason(`User has bad links in posts: ${uniq(badLinksFromPosts).join(", ")}`);
            return true;
        }

        const userSocialLinks = await this.getSocialLinks(user.username);
        if (userSocialLinks.length === 0) {
            return false;
        }

        const badSocialLinksFound = userSocialLinks.filter(link => badSocialLinks.some(badLink => link.outboundUrl.startsWith(badLink)));
        if (badSocialLinksFound.length > 0) {
            this.addHitReason(`User has bad social links: ${uniq(badSocialLinksFound.map(link => link.outboundUrl)).join(", ")}`);
            return true;
        }

        return false;
    }
}
