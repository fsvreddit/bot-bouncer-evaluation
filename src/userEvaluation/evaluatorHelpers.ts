import { TriggerContext, UserSocialLink } from "@devvit/public-api";
import { getUserSocialLinks } from "devvit-helpers";
import { addMinutes } from "date-fns";
import { MAIN_APP_NAME } from "../constants";

export function domainFromUrl (url: string): string | undefined {
    if (!url || url.startsWith("/")) {
        // Reddit internal link or crosspost
        return;
    }

    const hostname = new URL(url).hostname;
    const trimmedHostname = hostname.startsWith("www.") ? hostname.substring(4) : hostname;

    return trimmedHostname;
}

export async function getSocialLinksWithCache (username: string, context: TriggerContext): Promise <UserSocialLink[]> {
    const cacheKey = `bbe:socialLinks:${username}`;
    const redis = context.appSlug === MAIN_APP_NAME ? context.redis.global : context.redis;
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached) as UserSocialLink[];
    }

    const socialLinks = await getUserSocialLinks(username, context.metadata);
    await redis.set(cacheKey, JSON.stringify(socialLinks), { expiration: addMinutes(new Date(), 5) });
    return socialLinks;
}
