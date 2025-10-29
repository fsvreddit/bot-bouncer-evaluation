import { Devvit, TriggerContext, User, UserSocialLink } from "@devvit/public-api";
import * as protos from "@devvit/protos";
import { UserAboutResponse } from "@devvit/protos/types/devvit/plugin/redditapi/users/users_msg.js";

export interface RedditAPIPlugins {
    NewModmail: protos.NewModmail;
    Widgets: protos.Widgets;
    ModNote: protos.ModNote;
    LinksAndComments: protos.LinksAndComments;
    Moderation: protos.Moderation;
    GraphQL: protos.GraphQL;
    Listings: protos.Listings;
    Flair: protos.Flair;
    Wiki: protos.Wiki;
    Users: protos.Users;
    PrivateMessages: protos.PrivateMessages;
    Subreddits: protos.Subreddits;
}

export type ExtendedDevvit = typeof Devvit & {
    redditAPIPlugins: RedditAPIPlugins;
};

export function getExtendedDevvit (): ExtendedDevvit {
    return Devvit as ExtendedDevvit; // The Devvit object already has the extended properties, they are simply not reflected in the public type definition.
}

async function getRawUserData (username: string, metadata: protos.Metadata): Promise<UserAboutResponse | undefined> {
    let userAboutResponse: UserAboutResponse | undefined;

    try {
        userAboutResponse = await getExtendedDevvit().redditAPIPlugins.Users.UserAbout({ username }, metadata);
    } catch (error) {
        if (error instanceof Error && (error.message.includes("404 Not Found") || error.message.includes("403 Forbidden"))) {
            return;
        }
        throw error; // Rethrow the error if it's not a 404 or 403
    }

    return userAboutResponse;
}

export interface UserExtended {
    createdAt: Date;
    commentKarma: number;
    displayName?: string;
    hasVerifiedEmail: boolean;
    id: string;
    isAdmin: boolean;
    isGold: boolean;
    isModerator: boolean;
    linkKarma: number;
    nsfw: boolean;
    username: string;
    userDescription?: string;
}

export async function getUserExtended (username: string, context: TriggerContext): Promise<UserExtended | undefined> {
    const rawUserData = await getRawUserData(username, context.metadata);
    if (!rawUserData?.data) {
        return;
    }

    const userExtendedVal = {
        createdAt: new Date((rawUserData.data.created ?? 0) * 1000),
        commentKarma: rawUserData.data.commentKarma ?? 0,
        displayName: rawUserData.data.subreddit?.title,
        hasVerifiedEmail: rawUserData.data.hasVerifiedEmail ?? false,
        id: `t2_${rawUserData.data.id ?? ""}`,
        isAdmin: rawUserData.data.isEmployee ?? false,
        isGold: rawUserData.data.isGold ?? false,
        isModerator: rawUserData.data.isMod ?? false,
        linkKarma: rawUserData.data.linkKarma ?? 0,
        nsfw: rawUserData.data.subreddit?.over18 ?? false,
        username: rawUserData.data.name ?? "",
        userDescription: rawUserData.data.subreddit?.publicDescription,
    };

    return userExtendedVal;
}

export async function getUserExtendedFromUser (user: User, context: TriggerContext): Promise<UserExtended> {
    try {
        const userExtended = await getUserExtended(user.username, context);
        if (userExtended) {
            return userExtended;
        }
    } catch {
        //
    }

    return {
        createdAt: user.createdAt,
        commentKarma: user.commentKarma,
        hasVerifiedEmail: user.hasVerifiedEmail,
        id: user.id,
        isAdmin: user.isAdmin,
        isGold: false,
        isModerator: false,
        linkKarma: user.linkKarma,
        nsfw: user.nsfw,
        username: user.username,
    };
}

type UserSocialLinkResponse = Omit<UserSocialLink, "handle"> & { handle: string | null };

export async function getUserSocialLinks (username: string, context: TriggerContext): Promise<UserSocialLink[]> {
    const gql = getExtendedDevvit().redditAPIPlugins.GraphQL;
    const response = await gql.PersistedQuery({
        operationName: "GetUserSocialLinks", // Name and ID are both from <https://github.com/reddit/devvit/blob/f083/packages/public-api/src/apis/reddit/models/User.ts#L437-L438>
        id: "2aca18ef5f4fc75fb91cdaace3e9aeeae2cb3843b5c26ad511e6f01b8521593a",
        variables: {
            name: username,
        },
    }, context.metadata);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!response.data?.user?.profile?.socialLinks) {
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return response.data.user.profile.socialLinks.map((link: UserSocialLinkResponse) => ({
        ...link,
        handle: link.handle ?? undefined,
    }));
}
