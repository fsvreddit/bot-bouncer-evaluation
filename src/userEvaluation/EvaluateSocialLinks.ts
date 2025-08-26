import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { subMonths, subYears } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "../types.js";

export class EvaluateSocialLinks extends UserEvaluatorBase {
    override name = "Social Links Bot";
    override shortname = "sociallinks";

    override banContentThreshold = 0;

    private getDomains (): string[] {
        const postDomains = this.getGenericVariable<string[]>("redditdomains", []);
        postDomains.push("redgifs.com", "instagram.com", "i.redd.it");
        return postDomains;
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

    override async preEvaluateUser (user: UserExtended): Promise<boolean> {
        const badSocialLinks = this.getVariable<string[]>("badlinks", []);
        if (badSocialLinks.length === 0) {
            return false;
        }

        const accountEligible = (user.commentKarma < 500 && user.createdAt > subMonths(new Date(), 2))
            || user.createdAt < subYears(new Date(), 5);

        if (!accountEligible) {
            return false;
        }

        const userSocialLinks = await this.getSocialLinks(user.username);
        if (userSocialLinks.length === 0) {
            return false;
        }

        const badSocialLinksFound = userSocialLinks.filter(link => badSocialLinks.some(badLink => link.outboundUrl.startsWith(badLink)));
        if (badSocialLinksFound.length > 0) {
            this.hitReason = `User has bad social links: ${badSocialLinksFound.map(link => link.outboundUrl).join(", ")}`;
            return true;
        }

        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
