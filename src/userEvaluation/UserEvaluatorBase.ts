import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { Comment, Post, TriggerContext, UserSocialLink } from "@devvit/public-api";
import { getUserSocialLinks, UserExtended } from "../extendedDevvit.js";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";

interface HistoryOptions {
    since?: Date;
    omitRemoved?: boolean;
    edited?: boolean;
}

export abstract class UserEvaluatorBase {
    protected reasons: string[] = [];
    protected context: TriggerContext;
    private variables: Record<string, unknown> = {};

    abstract name: string;
    abstract shortname: string;

    public socialLinks: UserSocialLink[] | undefined;

    public setReason (reason: string) {
        this.reasons.push(reason);
    }

    public getReasons () {
        return this.reasons;
    }

    public banContentThreshold = 10;
    public canAutoBan = true;

    constructor (context: TriggerContext, socialLinks: UserSocialLink[] | undefined, variables: Record<string, unknown>) {
        this.context = context;
        this.socialLinks = socialLinks;
        this.variables = variables;
    }

    public evaluatorDisabled () {
        return this.getVariable<boolean>("killswitch", false);
    }

    public validateVariables (): string[] {
        return [];
    }

    public getSubGroups (): string[] | undefined {
        return;
    }

    protected getAllVariables (filter?: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        const root = this.shortname + ":" + (filter ?? "");
        for (const key in this.variables) {
            if (key.startsWith(root)) {
                result[key] = this.variables[key];
            }
        }
        return result;
    }

    protected getVariable<Type> (name: string, defaultValue: Type): Type {
        return this.variables[`${this.shortname}:${name}`] as Type | undefined ?? defaultValue;
    }

    protected getGenericVariable<Type> (name: string, defaultValue: Type): Type {
        return this.variables[`generic:${name}`] as Type | undefined ?? defaultValue;
    }

    protected async getSocialLinks (username: string): Promise<UserSocialLink[]> {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (this.socialLinks === undefined) {
            this.socialLinks = await getUserSocialLinks(username, this.context);
        }
        return this.socialLinks;
    }

    protected addHitReason (reason: string) {
        if (!this.hitReasons) {
            this.hitReasons = [reason];
        } else {
            this.hitReasons.push(reason);
        }
    }

    public hitReasons: string[] | undefined = undefined;

    abstract preEvaluateComment (event: CommentCreate): boolean | Promise<boolean>;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public preEvaluateCommentEdit (event: CommentUpdate): boolean | Promise<boolean> {
        return false;
    }

    abstract preEvaluatePost (post: Post): boolean;

    abstract preEvaluateUser (user: UserExtended): boolean | Promise<boolean>;

    abstract evaluate (user: UserExtended, history: (Post | Comment)[]): boolean | Promise<boolean>;

    private getContent (history: (Post | Comment)[], options?: HistoryOptions): (Post | Comment)[] {
        const filteredHistory = history.filter((item) => {
            if (options?.since && item.createdAt < options.since) {
                return false;
            }
            if (options?.omitRemoved && item.body === "[removed]") {
                return false;
            }
            if (options?.edited !== undefined) {
                return item.edited === options.edited;
            }
            return true;
        });
        return filteredHistory;
    }

    protected getComments (history: (Post | Comment)[], options?: HistoryOptions): Comment[] {
        const filteredHistory = this.getContent(history, options);
        return filteredHistory.filter(item => isCommentId(item.id)) as Comment[];
    }

    protected getPosts (history: (Post | Comment)[], options?: HistoryOptions): Post[] {
        const filteredHistory = this.getContent(history, options);
        return filteredHistory.filter(item => isLinkId(item.id)) as Post[];
    }
}
