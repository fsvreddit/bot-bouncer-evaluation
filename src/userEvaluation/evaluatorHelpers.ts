import { TriggerContext, UserSocialLink } from "@devvit/public-api";
import { getUserSocialLinks } from "../extendedDevvit";
import { addHours } from "date-fns";

export function domainFromUrl (url: string): string | undefined {
    if (!url || url.startsWith("/")) {
        // Reddit internal link or crosspost
        return;
    }

    const hostname = new URL(url).hostname;
    const trimmedHostname = hostname.startsWith("www.") ? hostname.substring(4) : hostname;

    return trimmedHostname;
}

export async function getSocialLinksWithCache (username: string, context: TriggerContext, cacheHours = 2): Promise <UserSocialLink[]> {
    const cacheKey = `bbe:socialLinks:${username}`;
    const cached = await context.redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached) as UserSocialLink[];
    }

    const socialLinks = await getUserSocialLinks(username, context);
    await context.redis.set(cacheKey, JSON.stringify(socialLinks), { expiration: addHours(new Date(), cacheHours) });
    return socialLinks;
}
