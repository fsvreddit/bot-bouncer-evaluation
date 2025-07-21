import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "../types.js";
import { endOfDay, parse, subDays } from "date-fns";

interface BotGroup {
    name: string;
    usernameRegexes?: RegExp[];
    dateFrom?: Date;
    dateTo?: Date;
    maxAccountAge?: number;
    subreddits: string[];
    commentRegexes: RegExp[];
}

export class EvaluateCommentBotGroup extends UserEvaluatorBase {
    override name = "Comment Bot Group";
    override shortname = "commentbotgroup";
    override banContentThreshold = 1;

    public getBotGroups (): BotGroup[] {
        const results: BotGroup[] = [];
        const variables = this.getAllVariables("group");
        const groups = Object.entries(variables).map(([key, value]) => ({ key, group: value as Record<string, unknown> }));
        for (const { key, group } of groups) {
            const name = group.name as string | undefined;
            const dateFrom = group.dateFrom as string | undefined;
            const dateTo = group.dateTo as string | undefined;
            const maxAccountAge = group.maxAccountAge as number | undefined;
            const subreddits = group.subreddits as string[] | undefined;
            let usernameRegexes: string[] | undefined;
            if (group.usernameRegex) {
                if (typeof group.usernameRegex === "string") {
                    usernameRegexes = [group.usernameRegex];
                } else if (Array.isArray(group.usernameRegex)) {
                    usernameRegexes = group.usernameRegex as string[];
                }
            }

            let commentRegexes: string[] | undefined;
            if (group.commentRegexes) {
                if (typeof group.commentRegexes === "string") {
                    commentRegexes = [group.commentRegexes];
                } else if (Array.isArray(group.commentRegexes)) {
                    commentRegexes = group.commentRegexes;
                }
            }

            if (!name || !subreddits || !commentRegexes) {
                throw new Error(`Bot group ${key} is missing required fields. Mandatory fields are name, dateFrom, dateTo, and usernameRegex.`);
            }

            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateFrom && !dateRegex.test(dateFrom)) {
                throw new Error(`Invalid date format for dateFrom in bot group ${key}. Expected format is YYYY-MM-DD.`);
            }

            if (dateTo && !dateRegex.test(dateTo)) {
                throw new Error(`Invalid date format for dateTo in bot group ${key}. Expected format is YYYY-MM-DD.`);
            }

            if (dateTo && dateFrom && dateFrom > dateTo) {
                throw new Error(`dateFrom cannot be after dateTo in bot group ${key}.`);
            }

            if (maxAccountAge && !dateFrom) {
                throw new Error(`Cannot specify accountAge without dateFrom in bot group ${key} for backwards compatibility reasons.`);
            }

            try {
                for (const usernameRegex of usernameRegexes ?? []) {
                    const regex = new RegExp(usernameRegex);
                    if (regex.test("")) {
                        throw new Error(`Username regex is too greedy in comment bot group ${key}: ${usernameRegex}`);
                    }
                }
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Invalid regex for usernameRegex in bot group ${key}: ${error.message}`);
                } else {
                    throw new Error(`Invalid regex for usernameRegex in bot group ${key}: ${error}`);
                }
            }

            try {
                results.push({
                    name,
                    usernameRegexes: usernameRegexes ? usernameRegexes.map(regex => new RegExp(regex)) : undefined,
                    dateFrom: dateFrom ? parse(dateFrom, "yyyy-MM-dd", new Date()) : undefined,
                    dateTo: dateTo ? endOfDay(parse(dateTo, "yyyy-MM-dd", new Date())) : undefined,
                    maxAccountAge,
                    subreddits,
                    commentRegexes: commentRegexes.map(regex => new RegExp(regex)),
                });
            } catch (error) {
                throw new Error(`Error parsing bot group ${key}: ${error}`);
            }
        }

        return results;
    }

    override validateVariables (): string[] {
        try {
            this.getBotGroups();
            return [];
        } catch (error) {
            if (error instanceof Error) {
                return [`Error parsing bot groups: ${error.message}`];
            }
            return [`Error parsing bot groups: ${error}`];
        }
    }

    override getSubGroups (): string[] | undefined {
        const botGroups = this.getBotGroups();
        if (botGroups.length === 0) {
            return;
        }

        return botGroups.map(group => group.name);
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        const comment = event.comment;
        if (!comment) {
            return false;
        }

        const subredditName = event.subreddit?.name;
        if (!subredditName) {
            return false;
        }

        const authorName = event.author?.name;
        if (!authorName) {
            return false;
        }

        const botGroups = this.getBotGroups();
        return botGroups.some((group) => {
            if (!group.commentRegexes.some(regex => group.subreddits.includes(subredditName) && regex.test(comment.body))) {
                return false;
            }

            if (group.usernameRegexes && !group.usernameRegexes.some(regex => regex.test(authorName))) {
                return false;
            }

            return true;
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return true;
    }

    private userMatchesGroup (user: UserExtended, group: BotGroup): boolean {
        if (group.usernameRegexes && !group.usernameRegexes.some(regex => regex.test(user.username))) {
            return false;
        }

        if (group.maxAccountAge && user.createdAt < subDays(new Date(), group.maxAccountAge)) {
            return false;
        }

        if (group.dateFrom && user.createdAt < group.dateFrom) {
            return false;
        }

        if (group.dateTo && user.createdAt > group.dateTo) {
            return false;
        }

        return true;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const botGroups = this.getBotGroups();
        return botGroups.some(group => this.userMatchesGroup(user, group));
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        const botGroups = this.getBotGroups();

        const matchedGroup = botGroups.find((group) => {
            const commentsInSubreddits = this.getComments(history)
                .filter(comment => group.subreddits.includes(comment.subredditName));

            return this.userMatchesGroup(user, group) && commentsInSubreddits.some(comment => group.commentRegexes.some(regex => regex.test(comment.body)));
        });

        if (!matchedGroup) {
            this.setReason("User does not match any bot group");
            return false;
        }

        this.hitReason = `User matches bot group ${matchedGroup.name}`;
        return true;
    }
}
