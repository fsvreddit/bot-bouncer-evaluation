import { TriggerContext, UserSocialLink } from "@devvit/public-api";
import { getUserSocialLinks } from "../extendedDevvit";
import { addHours, addMinutes } from "date-fns";

export function domainFromUrl (url: string): string | undefined {
    if (!url || url.startsWith("/")) {
        // Reddit internal link or crosspost
        return;
    }

    const hostname = new URL(url).hostname;
    const trimmedHostname = hostname.startsWith("www.") ? hostname.substring(4) : hostname;

    return trimmedHostname;
}

export async function getSocialLinksWithCache (username: string, context: TriggerContext, cacheHours?: number): Promise <UserSocialLink[]> {
    const cacheKey = `bbe:socialLinks:${username}`;
    const cached = await context.redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached) as UserSocialLink[];
    }

    const expirationTime = cacheHours ? addHours(new Date(), cacheHours) : addMinutes(new Date(), 10);

    const socialLinks = await getUserSocialLinks(username, context);
    await context.redis.set(cacheKey, JSON.stringify(socialLinks), { expiration: expirationTime });
    return socialLinks;
}
