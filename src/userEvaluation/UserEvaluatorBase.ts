import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { Comment, Post, TriggerContext, UserSocialLink } from "@devvit/public-api";
import { UserExtended } from "../extendedDevvit.js";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";
import { getSocialLinksWithCache } from "./evaluatorHelpers.js";

interface HistoryOptions {
    since?: Date;
    omitRemoved?: boolean;
    edited?: boolean;
}

export interface ValidationIssue {
    severity: "error" | "warning";
    message: string;
}

export interface EvaluatorRegex {
    evaluatorName: string;
    subName?: string;
    regex: string;
    flags?: string;
}

interface HitReasonDetailed {
    reason: string;
    details: { key: string; value: string }[];
}

export type HitReason = string | HitReasonDetailed;

export abstract class UserEvaluatorBase {
    protected context: TriggerContext;
    private variables: Record<string, unknown> = {};

    abstract name: string;
    abstract shortname: string;

    public socialLinks: UserSocialLink[] | undefined;

    public banContentThreshold = 10;
    public canAutoBan = true;

    protected history: (Post | Comment)[];
    private userPosts: Post[] | undefined;
    private userComments: Comment[] | undefined;
    protected ignoredSubs: Set<string>;

    constructor (context: TriggerContext, history: (Post | Comment)[], socialLinks: UserSocialLink[] | undefined, variables: Record<string, unknown>) {
        this.context = context;
        this.socialLinks = socialLinks;
        this.variables = variables;

        this.ignoredSubs = new Set(this.getGenericVariable<string[]>("ignoredsubs", []));
        this.history = history;
    }

    public setHistory (history: (Post | Comment)[]) {
        this.history = history;
        this.userPosts = undefined;
        this.userComments = undefined;
    }

    public evaluatorDisabled () {
        return this.getVariable("killswitch", false);
    }

    public validateVariables (): ValidationIssue[] {
        return [];
    }

    public gatherRegexes (): EvaluatorRegex[] {
        return [];
    }

    public getSubGroups (): string[] | undefined {
        return;
    }

    public getVariableOverrides (): Record<string, unknown> {
        return {};
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

    protected getModuleVariable<Type> (module: string, name: string, defaultValue: Type): Type {
        return this.variables[`${module}:${name}`] as Type | undefined ?? defaultValue;
    }

    protected async getSocialLinks (username: string): Promise<UserSocialLink[]> {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (this.socialLinks === undefined) {
            this.socialLinks = await getSocialLinksWithCache(username, this.context);
        }
        return this.socialLinks;
    }

    protected addHitReason (reason: HitReason) {
        if (!this.hitReasons) {
            this.hitReasons = [reason];
        } else {
            this.hitReasons.push(reason);
        }
    }

    public hitReasons: HitReason[] | undefined = undefined;

    abstract preEvaluateComment (event: CommentCreate): boolean | Promise<boolean>;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public preEvaluateCommentEdit (event: CommentUpdate): boolean | Promise<boolean> {
        return false;
    }

    abstract preEvaluatePost (post: Post): boolean;

    abstract preEvaluateUser (user: UserExtended): boolean | Promise<boolean>;

    abstract evaluate (user: UserExtended): boolean | Promise<boolean>;

    private getContent (history: (Post | Comment)[], options?: HistoryOptions): (Post | Comment)[] {
        if (!options) {
            return history;
        }

        const filteredHistory = history.filter((item) => {
            if (options.since && item.createdAt < options.since) {
                return false;
            }
            if (options.omitRemoved && item.body === "[removed]") {
                return false;
            }
            if (options.edited !== undefined) {
                return item.edited === options.edited;
            }
            return true;
        });
        return filteredHistory;
    }

    protected getComments (options?: HistoryOptions): Comment[] {
        this.userComments ??= this.history.filter(item => isCommentId(item.id) && !this.ignoredSubs.has(item.subredditName)) as Comment[];
        return this.getContent(this.userComments, options) as Comment[];
    }

    protected getPosts (options?: HistoryOptions): Post[] {
        this.userPosts ??= this.history.filter(item => isLinkId(item.id) && !this.ignoredSubs.has(item.subredditName)) as Post[];
        return this.getContent(this.userPosts, options) as Post[];
    }
}
