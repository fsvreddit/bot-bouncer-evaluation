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
