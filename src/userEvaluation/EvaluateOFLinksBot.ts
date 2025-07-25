import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { Comment, Post, UserSocialLink } from "@devvit/public-api";
import { subDays } from "date-fns";
import { UserExtended } from "../types.js";
import { getUserOrUndefined } from "../utility.js";

export class EvaluateOFLinksBot extends UserEvaluatorBase {
    override name = "OF Links Bot";
    override shortname = "oflinks";
    override banContentThreshold = 0;
    override canAutoBan = true;

    protected async getSocialLinks (username: string): Promise<UserSocialLink[]> {
        const user = await getUserOrUndefined(username, this.context);
        if (!user) {
            return [];
        }
        const socialLinks = await user.getSocialLinks();
        return socialLinks;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_event: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        return post.isNsfw();
    }

    override async preEvaluateUser (user: UserExtended): Promise<boolean> {
        if (!user.displayName) {
            return false;
        }

        const usernameRegex = /^([A-Z][a-z]+)(?: (?::\)|\p{Emoji}))?$/u;
        const usernameMatch = usernameRegex.exec(user.displayName);
        if (!usernameMatch) {
            this.setReason("User does not have a valid display name format");
            return false;
        }

        const username = usernameMatch[1];

        const maxAgeInDays = this.getVariable<number>("maxageindays", 30);
        if (user.createdAt < subDays(new Date(), maxAgeInDays)) {
            this.setReason("User is older than the max age limit");
            return false;
        }

        const prefixes = (this.getVariable<string[]>("prefixes", []))
            .map(prefix => `${prefix}${username.toLowerCase()}`);

        if (prefixes.length === 0) {
            this.setReason("No prefixes defined for OF links");
            return false;
        }

        const socialLinks = await this.getSocialLinks(user.username);
        const matchedPrefix = prefixes.find(prefix => socialLinks.some(link => link.outboundUrl.startsWith(prefix)));
        if (!matchedPrefix) {
            this.setReason("User does not have relevant links in their profile");
            return false;
        }

        this.hitReason = `User has OF links in their profile: ${matchedPrefix}`;
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
