import { TriggerContext, UserSocialLink } from "@devvit/public-api";
import { addMinutes } from "date-fns";
import { getUserSocialLinks } from "devvit-helpers";

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
    const cacheKey = `socialLinks:${username}`;
    const cachedValue = await context.redis.get(cacheKey);
    if (cachedValue) {
        return JSON.parse(cachedValue) as UserSocialLink[];
    }

    const userSocialLinks = await getUserSocialLinks(username, context.metadata);
    await context.redis.set(cacheKey, JSON.stringify(userSocialLinks), { expiration: addMinutes(new Date(), 5) });

    return userSocialLinks;
}
