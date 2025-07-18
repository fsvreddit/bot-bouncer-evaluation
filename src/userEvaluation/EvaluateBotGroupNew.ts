import { Comment, Post, UserSocialLink } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "../types.js";
import { endOfDay, parse, subDays } from "date-fns";
import { CommentV2 } from "@devvit/protos/types/devvit/reddit/v2alpha/commentv2.js";
import { domainFromUrl } from "./evaluatorHelpers.js";

interface AgeRange {
    dateFrom: string;
    dateTo?: string;
}

interface AgeInDays {
    maxAgeInDays?: number;
    minAgeInDays?: number; // Optional, not used in this implementation
}

type AgeCriteria = AgeRange | AgeInDays;

function validateAgeCriteria (age: AgeCriteria): string[] {
    const errors: string[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (Object.keys(age).includes("dateFrom")) {
        const { dateFrom, dateTo } = age as AgeRange;
        if (!dateFrom || !dateRegex.test(dateFrom)) {
            errors.push("Invalid or missing dateFrom in age criteria.");
        }
        if (dateTo && !dateRegex.test(dateTo)) {
            errors.push("Invalid date format for dateTo in age criteria. Expected format is YYYY-MM-DD.");
        }

        if (Object.keys(age).includes("maxAgeInDays") || Object.keys(age).includes("minAgeInDays")) {
            errors.push("Cannot specify both date range and min/maxAgeInDays in age criteria.");
        }
    }

    if (Object.keys(age).includes("maxAgeInDays")) {
        const { maxAgeInDays } = age as AgeInDays;
        if (typeof maxAgeInDays !== "number" || maxAgeInDays <= 0) {
            errors.push("maxAgeInDays must be a positive number.");
        }
    }

    if (Object.keys(age).includes("minAgeInDays")) {
        const { minAgeInDays } = age as AgeInDays;
        if (typeof minAgeInDays !== "number" || minAgeInDays <= 0) {
            errors.push("minAgeInDays must be a positive number.");
        }
    } else if (!Object.keys(age).includes("dateFrom") && !Object.keys(age).includes("maxAgeInDays")) {
        // If neither date range nor maxAgeInDays is specified, it's an error
        errors.push("Age criteria must specify either date range or maxAgeInDays.");
    }

    const keys = Object.keys(age);
    const expectedKeys = ["dateFrom", "dateTo", "maxAgeInDays"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push(`Unexpected key in age criteria: ${key}`);
        }
    }

    if (!keys.includes("dateFrom") && !keys.includes("maxAgeInDays") && !keys.includes("minAgeInDays")) {
        errors.push("Age criteria must specify at least one of dateFrom, maxAgeInDays, or minAgeInDays.");
    }

    return errors;
}

interface NotCondition {
    not: CriteriaGroup;
}

interface Every {
    every: CriteriaGroup[];
}

interface SomeCondition {
    some: CriteriaGroup[];
}

interface BaseItemCondition {
    matchesNeeded?: number;
    age?: AgeCriteria;
    subredditName?: string[];
    notSubredditName?: string[];
    bodyRegex?: string[];
}

interface PostCondition extends BaseItemCondition {
    type: "post";
    pinned?: boolean;
    titleRegex?: string[];
    nsfw?: boolean;
    urlRegex?: string[];
    domain?: string[];
}

function validateRegexArray (regexes: string[]): string[] {
    const errors: string[] = [];
    if (!Array.isArray(regexes)) {
        errors.push("Expected an array of regex strings.");
    } else {
        for (const regexString of regexes) {
            if (typeof regexString !== "string") {
                errors.push(`Invalid regex: ${regexString}. Must be a string.`);
                continue;
            }
            try {
                const regex = new RegExp(regexString, "u");
                if (regex.test("bot-bouncer")) {
                    errors.push(`Regex ${regexString} appears to be too greedy.`);
                }
            } catch {
                errors.push(`Invalid regex: ${regexString}`);
            }
        }
    }

    return errors;
}

function validatePostCondition (condition: PostCondition): string[] {
    const errors: string[] = [];
    if (condition.pinned !== undefined && typeof condition.pinned !== "boolean") {
        errors.push("pinned must be a boolean.");
    }

    if (condition.titleRegex) {
        errors.push(...validateRegexArray(condition.titleRegex));
    }

    if (condition.nsfw !== undefined && typeof condition.nsfw !== "boolean") {
        errors.push("nsfw must be a boolean.");
    }

    if (condition.urlRegex) {
        errors.push(...validateRegexArray(condition.urlRegex));
    }

    if (condition.domain) {
        if (!Array.isArray(condition.domain)) {
            errors.push("domain must be an array.");
        } else {
            for (const domain of condition.domain) {
                if (typeof domain !== "string") {
                    errors.push(`Invalid domain: ${domain}. Must be a string.`);
                }
            }
        }
    }

    const keys = Object.keys(condition);
    const expectedKeys = ["type", "pinned", "matchesNeeded", "age", "subredditName", "notSubredditName", "bodyRegex", "titleRegex", "nsfw", "urlRegex", "domain"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push(`Unexpected key in post condition: ${key}`);
        }
    }

    return errors;
}

interface CommentCondition extends BaseItemCondition {
    type: "comment";
}

function validateCommentCondition (condition: CommentCondition): string[] {
    const errors: string[] = [];
    const keys = Object.keys(condition);
    const expectedKeys = ["type", "matchesNeeded", "age", "subredditName", "notSubredditName", "bodyRegex"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push(`Unexpected key in comment condition: ${key}`);
        }
    }

    return errors;
}

function validateCondition (condition: PostCondition | CommentCondition): string[] {
    const errors: string[] = [];

    if (condition.matchesNeeded && condition.matchesNeeded < 1) {
        errors.push("matchesNeeded must be at least 1.");
    }

    if (condition.age) {
        errors.push(...validateAgeCriteria(condition.age).map(error => `Age criteria: ${error}`));
    }

    if (condition.subredditName) {
        if (!Array.isArray(condition.subredditName)) {
            errors.push("subredditName must be an array.");
        } else {
            if (condition.subredditName.includes("")) {
                errors.push("subredditName cannot be an empty string.");
            }
        }
    }

    if (condition.notSubredditName) {
        if (!Array.isArray(condition.notSubredditName)) {
            errors.push("notSubredditName must be an array.");
        } else {
            if (condition.notSubredditName.includes("")) {
                errors.push("notSubredditName cannot be an empty string.");
            }
        }
    }

    if (condition.bodyRegex) {
        errors.push(...validateRegexArray(condition.bodyRegex));
    }

    if (condition.type === "post") {
        errors.push(...validatePostCondition(condition));
    } else { // Comment condition
        errors.push(...validateCommentCondition(condition));
    }

    return errors;
}

type CriteriaGroup = NotCondition | Every | SomeCondition | PostCondition | CommentCondition;

function validateCriteriaGroup (criteria: CriteriaGroup, level = 0): string[] {
    const errors: string[] = [];
    if (Array.isArray(criteria)) {
        errors.push("Criteria cannot be an array. Use 'and' or 'or' to combine conditions.");
    }

    if ("not" in criteria) {
        if (level > 1) {
            errors.push("Nested 'not' conditions are not allowed.");
        }
        if (typeof criteria.not !== "object" || Array.isArray(criteria.not)) {
            errors.push("'not' condition must be a single condition.");
        }
        errors.push(...validateCriteriaGroup(criteria.not, level + 1));
    } else if ("every" in criteria) {
        if (!Array.isArray(criteria.every) || criteria.every.length === 0) {
            errors.push("'all' must be an array of conditions.");
        }
        for (const subCriteria of criteria.every) {
            errors.push(...validateCriteriaGroup(subCriteria, level + 1));
        }
    } else if ("some" in criteria) {
        if (criteria.some.some(subCriteria => "not" in subCriteria)) {
            errors.push("Nested 'not' conditions within 'or' are not allowed.");
        }
        if (!Array.isArray(criteria.some) || criteria.some.length === 0) {
            errors.push("'some' must be an array of conditions.");
        }
        for (const subCriteria of criteria.some) {
            errors.push(...validateCriteriaGroup(subCriteria, level + 1));
        }
    } else {
        errors.push(...validateCondition(criteria));
    }

    const keys = Object.keys(criteria);
    const expectedKeys = ["not", "every", "some", "type", "pinned", "matchesNeeded", "age", "subredditName", "notSubredditName", "bodyRegex", "titleRegex", "nsfw", "urlRegex", "domain"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push(`Unexpected key in criteria group: ${key}`);
        }
    }

    return errors;
}

interface BotGroup {
    name: string;
    usernameRegex?: string[];
    maxCommentKarma?: number;
    maxLinkKarma?: number;
    age?: AgeCriteria;
    nsfw?: boolean;
    bioRegex?: string[];
    displayNameRegex?: string[];
    socialLinkRegex?: string[];
    criteria?: CriteriaGroup;
}

function validateBotGroup (group: BotGroup): string[] {
    const errors: string[] = [];
    if (!group.name) {
        errors.push("Bot group name is required.");
    }

    if (group.usernameRegex) {
        errors.push(...validateRegexArray(group.usernameRegex));
    }

    if (group.age) {
        errors.push(...validateAgeCriteria(group.age).map(error => `Account age: ${error}`));
    }

    if (group.bioRegex) {
        errors.push(...validateRegexArray(group.bioRegex));
    }

    if (group.displayNameRegex) {
        errors.push(...validateRegexArray(group.displayNameRegex));
    }

    if (group.socialLinkRegex) {
        errors.push(...validateRegexArray(group.socialLinkRegex));
    }

    if (group.criteria) {
        errors.push(...validateCriteriaGroup(group.criteria));
    }

    const keys = Object.keys(group);
    const expectedKeys = ["name", "usernameRegex", "maxCommentKarma", "maxLinkKarma", "age", "nsfw", "bioRegex", "displayNameRegex", "socialLinks", "criteria"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push(`Unexpected key in bot group: ${key}`);
        }
    }

    return errors;
}

export class EvaluateBotGroupNew extends UserEvaluatorBase {
    override name = "Bot Group New";
    override shortname = "botgroupnew";
    override banContentThreshold = 1;

    private socialLinks: UserSocialLink[] | undefined;

    private async getSocialLinks (user: UserExtended): Promise<UserSocialLink[]> {
        if (this.socialLinks) {
            return this.socialLinks;
        }

        const actualUser = await this.context.reddit.getUserByUsername(user.username);
        if (!actualUser) {
            return [];
        }

        this.socialLinks = await actualUser.getSocialLinks();
        return this.socialLinks;
    }

    private anyRegexMatches (input: string, regexes: string[]): boolean {
        return regexes.some(regex => new RegExp(regex, "u").test(input));
    }

    public getBotGroups (): BotGroup[] {
        const groups = this.getAllVariables("group") as Record<string, BotGroup>;

        return Object.values(groups);
    }

    override validateVariables (): string[] {
        const errors: string[] = [];
        const groups = this.getAllVariables("group") as Record<string, BotGroup>;
        for (const [key, group] of Object.entries(groups)) {
            errors.push(...validateBotGroup(group).map(error => `Bot group ${key}: ${error}`));
        }

        return errors;
    }

    private matchesAgeCriteria (date: Date, age: AgeCriteria): boolean {
        if ("dateFrom" in age) {
            const dateFrom = parse(age.dateFrom, "yyyy-MM-dd", new Date());
            if (date < dateFrom) {
                return false;
            }
            if (age.dateTo) {
                const dateTo = parse(age.dateTo, "yyyy-MM-dd", new Date());
                if (date > endOfDay(dateTo)) {
                    return false;
                }
            }
        }

        if ("maxAgeInDays" in age && age.maxAgeInDays) {
            const maxAgeDate = subDays(new Date(), age.maxAgeInDays);
            if (date < maxAgeDate) {
                return false;
            }
        }

        if ("minAgeInDays" in age && age.minAgeInDays) {
            const minAgeDate = subDays(new Date(), age.minAgeInDays);
            if (date > minAgeDate) {
                return false;
            }
        }

        return true;
    }

    private anySubredditMatches (item: Post | Comment | CommentV2, subredditNames: string[]): boolean {
        const subredditName = "subredditName" in item ? item.subredditName : this.context.subredditName;
        const authorName = "authorName" in item ? item.authorName : undefined;
        return subredditNames.some(subreddit => subredditName === subreddit)
            || subredditNames.some(subreddit => subreddit === "{profile}" && subredditName === `u_${authorName}`);
    }

    private postOrCommentMatchesCondition (item: Post | Comment | CommentV2, condition: CommentCondition | PostCondition) {
        if (condition.bodyRegex && item.body && !this.anyRegexMatches(item.body, condition.bodyRegex)) {
            return false;
        }

        if (condition.subredditName && !this.anySubredditMatches(item, condition.subredditName)) {
            return false;
        }

        if (condition.notSubredditName && this.anySubredditMatches(item, condition.notSubredditName)) {
            return false;
        }

        if (condition.age) {
            const referenceDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
            if (!this.matchesAgeCriteria(referenceDate, condition.age)) {
                return false;
            }
        }

        return true;
    }

    private collectCommentConditionsForPreEvalation (criteria: CriteriaGroup): CommentCondition[] {
        const conditions: CommentCondition[] = [];
        if ("type" in criteria && criteria.type === "comment") {
            conditions.push(criteria);
        } else if ("every" in criteria) {
            for (const subCriteria of criteria.every) {
                conditions.push(...this.collectCommentConditionsForPreEvalation(subCriteria));
            }
        } else if ("some" in criteria) {
            for (const subCriteria of criteria.some) {
                conditions.push(...this.collectCommentConditionsForPreEvalation(subCriteria));
            }
        }

        return conditions;
    }

    override preEvaluateComment (comment: CommentCreate): boolean {
        if (!comment.comment) {
            return false;
        }

        const groups = this.getBotGroups();
        return groups.some((group) => {
            if (group.usernameRegex) {
                if (!comment.author?.name) {
                    return false;
                }

                if (!this.anyRegexMatches(comment.author.name, group.usernameRegex)) {
                    return false;
                }
            }

            if (!group.criteria) {
                return true;
            };

            const commentConditions: CommentCondition[] = this.collectCommentConditionsForPreEvalation(group.criteria);
            return commentConditions.some(condition => comment.comment && this.postOrCommentMatchesCondition(comment.comment, condition));
        });
    }

    private postMatchesCondition (post: Post, condition: PostCondition) {
        if (!this.postOrCommentMatchesCondition(post, condition)) {
            return false;
        }

        if (condition.pinned !== undefined && post.stickied !== condition.pinned) {
            return false;
        }

        if (condition.nsfw !== undefined && post.nsfw !== condition.nsfw) {
            return false;
        }

        if (condition.titleRegex && !this.anyRegexMatches(post.title, condition.titleRegex)) {
            return false;
        }

        if (condition.urlRegex && !this.anyRegexMatches(post.url, condition.urlRegex)) {
            return false;
        }

        if (condition.domain) {
            const domain = domainFromUrl(post.url);
            if (!domain) {
                return false;
            }
            if (!condition.domain.includes(domain)) {
                return false;
            }
        }

        return true;
    }

    private collectPostConditionsForPreEvalation (criteria: CriteriaGroup): PostCondition[] {
        const conditions: PostCondition[] = [];
        if ("type" in criteria && criteria.type === "post") {
            conditions.push(criteria);
        } else if ("every" in criteria) {
            for (const subCriteria of criteria.every) {
                conditions.push(...this.collectPostConditionsForPreEvalation(subCriteria));
            }
        } else if ("some" in criteria) {
            for (const subCriteria of criteria.some) {
                conditions.push(...this.collectPostConditionsForPreEvalation(subCriteria));
            }
        }

        return conditions;
    }

    override preEvaluatePost (post: Post): boolean {
        const groups = this.getBotGroups();
        return groups.some((group) => {
            if (group.usernameRegex && !this.anyRegexMatches(post.authorName, group.usernameRegex)) {
                return false;
            }

            if (!group.criteria) {
                return true;
            };

            const postConditions: PostCondition[] = this.collectPostConditionsForPreEvalation(group.criteria);
            return postConditions.some(condition => this.postMatchesCondition(post, condition));
        });
    }

    private async accountMatchesGroup (user: UserExtended, group: BotGroup): Promise<boolean> {
        if (group.usernameRegex && !this.anyRegexMatches(user.username, group.usernameRegex)) {
            this.setReason(`Username does not match regex in group ${group.name}`);
            return false;
        }

        if (group.age && !this.matchesAgeCriteria(user.createdAt, group.age)) {
            this.setReason(`Account age does not match criteria in group ${group.name}`);
            return false;
        }

        if (group.maxCommentKarma && user.commentKarma > group.maxCommentKarma) {
            this.setReason(`Comment karma exceeds limit in group ${group.name}`);
            return false;
        }

        if (group.maxLinkKarma && user.linkKarma > group.maxLinkKarma) {
            this.setReason(`Link karma exceeds limit in group ${group.name}`);
            return false;
        }

        if (group.nsfw !== undefined && user.nsfw !== group.nsfw) {
            this.setReason(`User is not marked as NSFW in group ${group.name}`);
            return false;
        }

        if (group.bioRegex && user.userDescription && !this.anyRegexMatches(user.userDescription, group.bioRegex)) {
            this.setReason(`Bio does not match regex in group ${group.name}`);
            return false;
        }

        if (group.displayNameRegex && user.displayName && !this.anyRegexMatches(user.displayName, group.displayNameRegex)) {
            this.setReason(`Display name does not match regex in group ${group.name}`);
            return false;
        }

        if (group.socialLinkRegex) {
            const userSocialLinks = await this.getSocialLinks(user);
            if (!userSocialLinks.some(userLink => group.socialLinkRegex && this.anyRegexMatches(userLink.outboundUrl, group.socialLinkRegex))) {
                this.setReason(`No matching social links found for user in group ${group.name}`);
                return false;
            }
        }

        return true;
    }

    override async preEvaluateUser (user: UserExtended): Promise<boolean> {
        const botGroups = this.getBotGroups();
        for (const group of botGroups) {
            const matches = await this.accountMatchesGroup(user, group);
            if (matches) {
                return true;
            }
        }

        return false;
    }

    private historyMatchesCriteriaGroup (history: (Post | Comment)[], criteria: CriteriaGroup): boolean {
        if ("not" in criteria) {
            return !this.historyMatchesCriteriaGroup(history, criteria.not);
        } else if ("every" in criteria) {
            return criteria.every.every(subCriteria => this.historyMatchesCriteriaGroup(history, subCriteria));
        } else if ("some" in criteria) {
            return criteria.some.some(subCriteria => this.historyMatchesCriteriaGroup(history, subCriteria));
        } else if ("type" in criteria) {
            if (criteria.type === "post") {
                const posts = this.getPosts(history);
                const matchingPosts = posts.filter(post => this.postMatchesCondition(post, criteria));
                if (matchingPosts.length === 0) {
                    return false;
                } else if (criteria.matchesNeeded && matchingPosts.length < criteria.matchesNeeded) {
                    return false;
                } else {
                    return true;
                }
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (criteria.type === "comment") {
                const comments = this.getComments(history);
                const matchingComments = comments.filter(comment => this.postOrCommentMatchesCondition(comment, criteria));
                if (matchingComments.length === 0) {
                    return false;
                } else if (criteria.matchesNeeded && matchingComments.length < criteria.matchesNeeded) {
                    return false;
                } else {
                    return true;
                }
            }
        }

        return false; // Default case, no specific conditions
    }

    override async evaluate (user: UserExtended, history: (Post | Comment)[]): Promise<boolean> {
        const botGroups = this.getBotGroups();

        for (const group of botGroups) {
            const accountMatches = await this.accountMatchesGroup(user, group);
            if (!accountMatches) {
                this.setReason(`User does not match account criteria in group ${group.name}`);
                continue;
            }

            if (group.criteria) {
                const historyMatchesGroup = this.historyMatchesCriteriaGroup(history, group.criteria);
                if (!historyMatchesGroup) {
                    this.setReason(`User does not match history criteria in group ${group.name}`);
                    continue;
                }
            }

            this.hitReason = group.name;
            return true;
        }

        return false; // No bot group matched
    }
}
