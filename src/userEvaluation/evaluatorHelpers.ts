import { TriggerContext, UserSocialLink } from "@devvit/public-api";
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
    return context.cache(
        async () => await getUserSocialLinks(username, context.metadata),
        {
            key: `socialLinks:${username}`,
            ttl: 5 * 60 * 1000, // 5 minutes
        },
    );
}
