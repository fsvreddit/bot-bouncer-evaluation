import { Comment, Post } from "@devvit/public-api";
import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { CommentV2 } from "@devvit/protos/types/devvit/reddit/v2alpha/commentv2.js";
import { isLinkId } from "@devvit/public-api/types/tid.js";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import { addDays, endOfDay, parse, subDays } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { compact, uniq } from "lodash";

interface AgeRange {
    dateFrom: string;
    dateTo?: string;
}

interface AgeInDays {
    maxAgeInDays?: number;
    minAgeInDays?: number;
}

type AgeCriteria = AgeRange | AgeInDays;

function validateAgeCriteria (age: AgeCriteria): ValidationIssue[] {
    const errors: ValidationIssue[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (Object.keys(age).includes("dateFrom")) {
        const { dateFrom, dateTo } = age as AgeRange;
        if (!dateRegex.test(dateFrom)) {
            errors.push({ severity: "error", message: "Invalid or missing dateFrom in age criteria." });
        }
        if (dateTo && !dateRegex.test(dateTo)) {
            errors.push({ severity: "error", message: "Invalid date format for dateTo in age criteria. Expected format is YYYY-MM-DD." });
        }

        if (Object.keys(age).includes("maxAgeInDays") || Object.keys(age).includes("minAgeInDays")) {
            errors.push({ severity: "error", message: "Cannot specify both date range and min/maxAgeInDays in age criteria." });
        }
    }

    if (Object.keys(age).includes("maxAgeInDays")) {
        const { maxAgeInDays } = age as AgeInDays;
        if (typeof maxAgeInDays !== "number" || maxAgeInDays <= 0) {
            errors.push({ severity: "error", message: "maxAgeInDays must be a positive number." });
        }
    }

    if (Object.keys(age).includes("minAgeInDays")) {
        const { minAgeInDays } = age as AgeInDays;
        if (typeof minAgeInDays !== "number" || minAgeInDays <= 0) {
            errors.push({ severity: "error", message: "minAgeInDays must be a positive number." });
        }
    } else if (!Object.keys(age).includes("dateFrom") && !Object.keys(age).includes("maxAgeInDays") && !Object.keys(age).includes("minAgeInDays")) {
        // If neither date range nor maxAgeInDays is specified, it's an error
        errors.push({ severity: "error", message: "Age criteria must specify either date range, maxAgeInDays, or minAgeInDays." });
    }

    const keys = Object.keys(age);
    const expectedKeys = ["dateFrom", "dateTo", "maxAgeInDays", "minAgeInDays"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push({ severity: "error", message: `Unexpected key in age criteria: ${key}` });
        }
    }

    if (!keys.includes("dateFrom") && !keys.includes("maxAgeInDays") && !keys.includes("minAgeInDays")) {
        errors.push({ severity: "error", message: "Age criteria must specify at least one of dateFrom, maxAgeInDays, or minAgeInDays." });
    }

    return errors;
}

interface NotCondition {
    not: CriteriaGroup;
}

interface EveryCondition {
    every: CriteriaGroup[];
}

interface SomeCondition {
    some: CriteriaGroup[];
}

interface BaseItemCondition {
    matchesNeeded?: number;
    age?: AgeCriteria;
    edited?: boolean;
    subredditName?: string[];
    notSubredditName?: string[];
    bodyRegex?: string[];
    minBodyLength?: number;
    maxBodyLength?: number;
    minParaCount?: number;
    maxParaCount?: number;
    minKarma?: number;
    maxKarma?: number;
}

interface PostCondition extends BaseItemCondition {
    type: "post";
    pinned?: boolean;
    titleRegex?: string[];
    nsfw?: boolean;
    urlRegex?: string[];
    domain?: string[];
    isCrossPost?: boolean;
}

function validateRegexArray (regexes: string[]): ValidationIssue[] {
    const errors: ValidationIssue[] = [];
    if (!Array.isArray(regexes)) {
        errors.push({ severity: "error", message: "Expected an array of regex strings." });
    } else {
        for (const regexString of regexes) {
            if (Array.isArray(regexString)) {
                errors.push({ severity: "error", message: "Regex must be a string, not an array." });
                continue;
            }
            if (typeof regexString !== "string") {
                errors.push({ severity: "error", message: `Invalid regex: ${regexString}. Must be a string.` });
                continue;
            }
            try {
                const regex = new RegExp(regexString, "u");
                if (regex.test("")) {
                    errors.push({ severity: "error", message: `Regex ${regexString} appears to be too greedy.` });
                }
            } catch {
                errors.push({ severity: "error", message: `Invalid regex: ${regexString}` });
            }
        }
    }

    return errors;
}

function validatePostCondition (condition: PostCondition): ValidationIssue[] {
    const errors: ValidationIssue[] = [];
    if (condition.pinned !== undefined && typeof condition.pinned !== "boolean") {
        errors.push({ severity: "error", message: "pinned must be a boolean." });
    }

    if (condition.titleRegex) {
        errors.push(...validateRegexArray(condition.titleRegex));
    }

    if (condition.nsfw !== undefined && typeof condition.nsfw !== "boolean") {
        errors.push({ severity: "error", message: "nsfw must be a boolean." });
    }

    if (condition.urlRegex) {
        errors.push(...validateRegexArray(condition.urlRegex));
    }

    if (condition.domain) {
        if (!Array.isArray(condition.domain)) {
            errors.push({ severity: "error", message: "domain must be an array." });
        } else {
            if (condition.domain.some(subreddit => Array.isArray(subreddit))) {
                errors.push({ severity: "error", message: "domain must be an array of strings, not arrays." });
            } else if (condition.domain.some(name => typeof name !== "string")) {
                errors.push({ severity: "error", message: "domain must be an array of strings." });
            }
            if (condition.domain.includes("")) {
                errors.push({ severity: "error", message: "domain cannot be an empty string." });
            }
        }
    }

    if (condition.isCrossPost !== undefined && typeof condition.isCrossPost !== "boolean") {
        errors.push({ severity: "error", message: "isCrossPost must be a boolean." });
    }

    const keys = Object.keys(condition);
    const expectedKeys = ["type", "pinned", "matchesNeeded", "age", "edited", "subredditName", "notSubredditName", "bodyRegex", "minBodyLength", "maxBodyLength", "minParaCount", "maxParaCount", "minKarma", "maxKarma", "titleRegex", "nsfw", "urlRegex", "domain", "isCrossPost"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push({ severity: "error", message: `Unexpected key in post condition: ${key}` });
        }
    }

    return errors;
}

interface CommentCondition extends BaseItemCondition {
    type: "comment";
    postId?: string[];
    isTopLevel?: boolean;
    isCommentOnOwnPost?: boolean;
    postTitleRegex?: string[];
}

function validateCommentCondition (condition: CommentCondition): ValidationIssue[] {
    const errors: ValidationIssue[] = [];

    if (condition.postId !== undefined && !Array.isArray(condition.postId)) {
        errors.push({ severity: "error", message: "postId must be an array." });
    }

    if (condition.postId?.some(postId => typeof postId !== "string")) {
        errors.push({ severity: "error", message: "postId must be an array of strings." });
    }

    const validPostIdRegex = /^[a-z0-9]{6,8}$/;
    if (condition.postId && !condition.postId.every(id => validPostIdRegex.test(id))) {
        errors.push({ severity: "error", message: `Invalid postId(s): ${condition.postId.filter(id => !validPostIdRegex.test(id)).join(", ")}. Must be a 6-8 character lower-case alphanumeric string.` });
    }

    if (condition.isTopLevel !== undefined && typeof condition.isTopLevel !== "boolean") {
        errors.push({ severity: "error", message: "isTopLevel must be a boolean." });
    }

    if (condition.isCommentOnOwnPost !== undefined && typeof condition.isCommentOnOwnPost !== "boolean") {
        errors.push({ severity: "error", message: "isCommentOnOwnPost must be a boolean." });
    }

    if (condition.postTitleRegex) {
        errors.push(...validateRegexArray(condition.postTitleRegex));
    }

    const keys = Object.keys(condition);
    const expectedKeys = ["type", "matchesNeeded", "age", "edited", "subredditName", "notSubredditName", "bodyRegex", "minBodyLength", "maxBodyLength", "minParaCount", "maxParaCount", "minKarma", "maxKarma", "postId", "isTopLevel", "isCommentOnOwnPost", "postTitleRegex"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push({ severity: "error", message: `Unexpected key in comment condition: ${key}` });
        }
    }

    return errors;
}

function validateCondition (condition: PostCondition | CommentCondition): ValidationIssue[] {
    const errors: ValidationIssue[] = [];

    if (condition.matchesNeeded !== undefined && typeof condition.matchesNeeded !== "number") {
        errors.push({ severity: "error", message: "matchesNeeded must be a number." });
    }

    if (condition.matchesNeeded !== undefined && condition.matchesNeeded < 1) {
        errors.push({ severity: "error", message: "matchesNeeded must be at least 1." });
    }

    if (condition.edited !== undefined && typeof condition.edited !== "boolean") {
        errors.push({ severity: "error", message: "edited must be a boolean." });
    }

    if (condition.age) {
        errors.push(...validateAgeCriteria(condition.age).map(error => ({ severity: error.severity, message: `Age criteria: ${error.message}` })));
    }

    if (condition.subredditName) {
        if (!Array.isArray(condition.subredditName)) {
            errors.push({ severity: "error", message: "subredditName must be an array." });
        } else {
            if (condition.subredditName.some(subreddit => Array.isArray(subreddit))) {
                errors.push({ severity: "error", message: "subredditName must be an array of strings, not arrays." });
            } else if (condition.subredditName.some(name => typeof name !== "string")) {
                errors.push({ severity: "error", message: "subredditName must be an array of strings." });
            }
            if (condition.subredditName.includes("")) {
                errors.push({ severity: "error", message: "subredditName cannot be an empty string." });
            }
        }
    }

    if (condition.notSubredditName) {
        if (!Array.isArray(condition.notSubredditName)) {
            errors.push({ severity: "error", message: "notSubredditName must be an array." });
        } else {
            if (condition.notSubredditName.some(subreddit => Array.isArray(subreddit))) {
                errors.push({ severity: "error", message: "notSubredditName must be an array of strings, not arrays." });
            } else if (condition.notSubredditName.some(name => typeof name !== "string")) {
                errors.push({ severity: "error", message: "notSubredditName must be an array of strings." });
            }
            if (condition.notSubredditName.includes("")) {
                errors.push({ severity: "error", message: "notSubredditName cannot be an empty string." });
            }
        }
    }

    if (condition.bodyRegex) {
        errors.push(...validateRegexArray(condition.bodyRegex));
    }

    if (condition.minBodyLength !== undefined && (typeof condition.minBodyLength !== "number" || condition.minBodyLength < 0)) {
        errors.push({ severity: "error", message: "minBodyLength must be a non-negative number." });
    }

    if (condition.maxBodyLength !== undefined && (typeof condition.maxBodyLength !== "number" || condition.maxBodyLength < 0)) {
        errors.push({ severity: "error", message: "maxBodyLength must be a non-negative number." });
    }

    if (condition.minParaCount !== undefined && (typeof condition.minParaCount !== "number" || condition.minParaCount < 0)) {
        errors.push({ severity: "error", message: "minParaCount must be a non-negative number." });
    }

    if (condition.maxParaCount !== undefined && (typeof condition.maxParaCount !== "number" || condition.maxParaCount < 0)) {
        errors.push({ severity: "error", message: "maxParaCount must be a non-negative number." });
    }

    if (condition.minKarma !== undefined && (typeof condition.minKarma !== "number" || condition.minKarma < 0)) {
        errors.push({ severity: "error", message: "minKarma must be a non-negative number." });
    }

    if (condition.maxKarma !== undefined && (typeof condition.maxKarma !== "number" || condition.maxKarma < 0)) {
        errors.push({ severity: "error", message: "maxKarma must be a non-negative number." });
    }

    if (condition.type === "post") {
        errors.push(...validatePostCondition(condition));
    } else { // Comment condition
        errors.push(...validateCommentCondition(condition));
    }

    return errors;
}

type CriteriaGroup = NotCondition | EveryCondition | SomeCondition | PostCondition | CommentCondition;

function validateCriteriaGroup (criteria: CriteriaGroup, level = 0): ValidationIssue[] {
    const errors: ValidationIssue[] = [];

    if (Array.isArray(criteria)) {
        errors.push({ severity: "error", message: "Criteria cannot be an array. Use 'every' or 'some' to combine conditions." });
        return errors;
    }

    const subKeys = Object.keys(criteria).filter(key => ["not", "every", "some", "type"].includes(key));
    if (subKeys.length === 0) {
        errors.push({ severity: "error", message: "Criteria must contain one condition or a group (not, every, some)." });
        return errors;
    }
    if (subKeys.length > 1) {
        errors.push({ severity: "error", message: "Criteria cannot contain multiple top-level conditions. Use 'every' or 'some' to combine them." });
        return errors;
    }

    if ("not" in criteria) {
        if (level > 1) {
            errors.push({ severity: "error", message: "Nested 'not' conditions are not allowed." });
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (criteria.not === null) {
            errors.push({ severity: "error", message: "'not' condition must not be empty." });
        } else if (typeof criteria.not !== "object" || Array.isArray(criteria.not)) {
            errors.push({ severity: "error", message: "'not' condition must be a single condition." });
        } else {
            errors.push(...validateCriteriaGroup(criteria.not, level + 1));
        }
    } else if ("every" in criteria) {
        if (!Array.isArray(criteria.every)) {
            errors.push({ severity: "error", message: "'every' must be an array of conditions." });
        } else if (criteria.every.length === 0) {
            errors.push({ severity: "error", message: "'every' must not be an empty array." });
        } else {
            for (const subCriteria of criteria.every) {
                errors.push(...validateCriteriaGroup(subCriteria, level + 1));
            }
        }
    } else if ("some" in criteria) {
        if (!Array.isArray(criteria.some)) {
            errors.push({ severity: "error", message: "'some' must be an array of conditions." });
        } else if (criteria.some.length === 0) {
            errors.push({ severity: "error", message: "'some' must not be an empty array." });
        } else {
            if (criteria.some.some(subCriteria => "not" in subCriteria)) {
                errors.push({ severity: "error", message: "Nested 'not' conditions within 'or' are not allowed." });
            }
            for (const subCriteria of criteria.some) {
                errors.push(...validateCriteriaGroup(subCriteria, level + 1));
            }
        }
    } else {
        errors.push(...validateCondition(criteria));
    }

    const keys = Object.keys(criteria);
    const expectedKeys = ["not", "every", "some", "type", "pinned", "matchesNeeded", "age", "edited", "subredditName", "notSubredditName", "bodyRegex", "titleRegex", "nsfw", "urlRegex", "domain", "postId", "isTopLevel", "isCommentOnOwnPost", "minBodyLength", "maxBodyLength", "minParaCount", "maxParaCount", "minKarma", "maxKarma", "postTitleRegex"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push({ severity: "error", message: `Unexpected key in criteria group: ${key}` });
        }
    }

    return errors;
}

interface BotGroup {
    name: string;
    usernameRegex?: string[];
    maxCommentKarma?: number;
    maxLinkKarma?: number;
    minCommentKarma?: number;
    minLinkKarma?: number;
    age?: AgeCriteria;
    nsfw?: boolean;
    bioRegex?: string[];
    displayNameRegex?: string[];
    socialLinkRegex?: string[];
    socialLinkTitleRegex?: string[];
    hasVerifiedEmail?: boolean;
    hasRedditPremium?: boolean;
    isSubredditModerator?: boolean;

    criteria?: CriteriaGroup;
}

function validateBotGroup (group: BotGroup | null): ValidationIssue[] {
    const errors: ValidationIssue[] = [];
    if (group === null) {
        return [{ severity: "error", message: "Bot group contains no properties." }];
    }

    if (!group.name) {
        errors.push({ severity: "error", message: "Bot group name is required." });
    }

    if (typeof group.name !== "string") {
        errors.push({ severity: "error", message: "Bot group name must be a string. You may need to enclose the group name in single quotes." });
    }

    if (group.usernameRegex) {
        errors.push(...validateRegexArray(group.usernameRegex));
    }

    if (group.age) {
        errors.push(...validateAgeCriteria(group.age).map(error => ({ severity: error.severity, message: `Account age: ${error.message}` })));
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

    if (group.socialLinkTitleRegex) {
        errors.push(...validateRegexArray(group.socialLinkTitleRegex));
        if (!group.socialLinkRegex || group.socialLinkRegex.length === 0) {
            errors.push({ severity: "error", message: "socialLinkTitleRegex is specified but socialLinkRegex is missing. socialLinkRegex must be specified if socialLinkTitleRegex is used." });
        }
    }

    if (group.criteria) {
        errors.push(...validateCriteriaGroup(group.criteria));
    }

    if (group.maxLinkKarma !== undefined) {
        if (typeof group.maxLinkKarma !== "number") {
            errors.push({ severity: "error", message: "Max link karma must be a number." });
        } else if (group.maxLinkKarma <= 0) {
            errors.push({ severity: "error", message: "Max link karma must be a positive number." });
        }
    }

    if (group.maxCommentKarma !== undefined) {
        if (typeof group.maxCommentKarma !== "number") {
            errors.push({ severity: "error", message: "Max comment karma must be a number." });
        } else if (group.maxCommentKarma <= 0) {
            errors.push({ severity: "error", message: "Max comment karma must be a positive number." });
        }
    }

    if (group.minLinkKarma !== undefined) {
        if (typeof group.minLinkKarma !== "number") {
            errors.push({ severity: "error", message: "Min link karma must be a number." });
        } else if (group.minLinkKarma < 0) {
            errors.push({ severity: "error", message: "Min link karma must be a non-negative number." });
        }
    }

    if (group.minCommentKarma !== undefined) {
        if (typeof group.minCommentKarma !== "number") {
            errors.push({ severity: "error", message: "Min comment karma must be a number." });
        } else if (group.minCommentKarma < 0) {
            errors.push({ severity: "error", message: "Min comment karma must be a non-negative number." });
        }
    }

    if (group.nsfw !== undefined && typeof group.nsfw !== "boolean") {
        errors.push({ severity: "error", message: "NSFW must be a boolean." });
    }

    if (group.hasVerifiedEmail !== undefined && typeof group.hasVerifiedEmail !== "boolean") {
        errors.push({ severity: "error", message: "Has verified email must be a boolean." });
    }

    if (group.hasRedditPremium !== undefined && typeof group.hasRedditPremium !== "boolean") {
        errors.push({ severity: "error", message: "Has Reddit Premium must be a boolean." });
    }

    if (group.isSubredditModerator !== undefined && typeof group.isSubredditModerator !== "boolean") {
        errors.push({ severity: "error", message: "Is subreddit moderator must be a boolean." });
    }

    const keys = Object.keys(group);
    const expectedKeys = ["name", "usernameRegex", "maxCommentKarma", "maxLinkKarma", "minCommentKarma", "minLinkKarma", "age", "nsfw", "bioRegex", "displayNameRegex", "socialLinkRegex", "socialLinkTitleRegex", "hasVerifiedEmail", "hasRedditPremium", "isSubredditModerator", "criteria"];
    for (const key of keys) {
        if (!expectedKeys.includes(key)) {
            errors.push({ severity: "error", message: `Unexpected key in bot group: ${key}` });
        }
    }

    return errors;
}

export class EvaluateBotGroupAdvanced extends UserEvaluatorBase {
    override name = "Bot Group Advanced";
    override shortname = "botgroupadvanced";
    override banContentThreshold = 0; // No content ban threshold for this evaluator to support account properties only checks

    private anyRegexMatches (input: string, regexes: string[]): boolean {
        return regexes.some(regex => new RegExp(regex, "u").test(input));
    }

    public getBotGroups (): BotGroup[] {
        const groups = this.getAllVariables("group") as Record<string, BotGroup>;

        return Object.values(groups);
    }

    override validateVariables (): ValidationIssue[] {
        const errors: ValidationIssue[] = [];
        const groups = this.getAllVariables("group") as Record<string, BotGroup>;
        for (const [key, group] of Object.entries(groups)) {
            errors.push(...validateBotGroup(group).map(error => ({ severity: error.severity, message: `Bot group ${key}: ${error.message}` })));
        }

        return errors;
    }

    private getCriteriaGroupRegexes (criteria: CriteriaGroup, groupName: string): EvaluatorRegex[] {
        if ("not" in criteria) {
            return this.getCriteriaGroupRegexes(criteria.not, groupName);
        } else if ("every" in criteria) {
            return criteria.every.flatMap(subCriteria => this.getCriteriaGroupRegexes(subCriteria, groupName));
        } else if ("some" in criteria) {
            return criteria.some.flatMap(subCriteria => this.getCriteriaGroupRegexes(subCriteria, groupName));
        } else {
            const regexes: EvaluatorRegex[] = [];
            if (criteria.bodyRegex) {
                regexes.push(...criteria.bodyRegex.map(regex => ({ evaluatorName: this.name, subName: groupName, regex, flags: "u" })));
            }

            if (criteria.type === "post") {
                if (criteria.titleRegex) {
                    regexes.push(...criteria.titleRegex.map(regex => ({ evaluatorName: this.name, subName: groupName, regex, flags: "u" })));
                }
                if (criteria.urlRegex) {
                    regexes.push(...criteria.urlRegex.map(regex => ({ evaluatorName: this.name, subName: groupName, regex })));
                }
            } else {
                if (criteria.postTitleRegex) {
                    regexes.push(...criteria.postTitleRegex.map(regex => ({ evaluatorName: this.name, subName: groupName, regex, flags: "u" })));
                }
            }

            return regexes;
        }
    }

    private getBotGroupRegexes (group: BotGroup): EvaluatorRegex[] {
        const regexes: EvaluatorRegex[] = [];

        if (group.usernameRegex) {
            for (const regex of group.usernameRegex) {
                regexes.push({ evaluatorName: this.name, subName: group.name, regex });
            }
        }

        if (group.bioRegex) {
            for (const regex of group.bioRegex) {
                regexes.push({ evaluatorName: this.name, subName: group.name, regex, flags: "u" });
            }
        }

        if (group.displayNameRegex) {
            for (const regex of group.displayNameRegex) {
                regexes.push({ evaluatorName: this.name, subName: group.name, regex, flags: "u" });
            }
        }

        if (group.socialLinkRegex) {
            for (const regex of group.socialLinkRegex) {
                regexes.push({ evaluatorName: this.name, subName: group.name, regex });
            }
        }

        if (group.socialLinkTitleRegex) {
            for (const regex of group.socialLinkTitleRegex) {
                regexes.push({ evaluatorName: this.name, subName: group.name, regex, flags: "u" });
            }
        }

        if (group.criteria) {
            regexes.push(...this.getCriteriaGroupRegexes(group.criteria, group.name));
        }

        return regexes;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const groups = this.getBotGroups();
        return uniq(groups.flatMap(group => this.getBotGroupRegexes(group)));
    }

    override getSubGroups (): string[] | undefined {
        const botGroups = this.getBotGroups();
        if (botGroups.length === 0) {
            return;
        }

        return botGroups.map(group => group.name);
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
        return subredditNames.some(subreddit => subredditName?.toLowerCase() === subreddit.toLowerCase())
            || subredditNames.some(subreddit => subreddit === "$profile" && subredditName === `u_${authorName}`);
    }

    private postOrCommentMatchesCondition (item: Post | Comment | CommentV2, condition: CommentCondition | PostCondition) {
        if (condition.edited !== undefined && "edited" in item && item.edited !== condition.edited) {
            return false;
        }

        if (condition.minBodyLength) {
            if (item.body === undefined) {
                return false;
            }
            if (item.body.length < condition.minBodyLength) {
                return false;
            }
        }

        if (condition.maxBodyLength) {
            const body = item.body ?? "";
            if (body.length > condition.maxBodyLength) {
                return false;
            }
        }

        if (condition.minParaCount) {
            if (item.body === undefined) {
                return false;
            }
            const paraCount = item.body.split("\n").filter(para => para.trim() !== "").length;
            if (paraCount < condition.minParaCount) {
                return false;
            }
        }

        if (condition.maxParaCount !== undefined) {
            const body = item.body ?? "";
            const paraCount = body.split("\n").filter(para => para.trim() !== "").length;
            if (paraCount > condition.maxParaCount) {
                return false;
            }
        }

        if (condition.bodyRegex) {
            if (item.body === undefined) {
                return false; // Body regex check requires body to be present
            }
            if (!this.anyRegexMatches(item.body, condition.bodyRegex)) {
                return false;
            }
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

        if (condition.minKarma !== undefined) {
            if (item.score < condition.minKarma) {
                return false;
            }
        }

        if (condition.maxKarma !== undefined) {
            if (item.score > condition.maxKarma) {
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

    override async preEvaluateComment (comment: CommentCreate): Promise<boolean> {
        if (!comment.comment) {
            return false;
        }

        const groups = this.getBotGroups();

        for (const group of groups) {
            if (group.usernameRegex) {
                if (!comment.author?.name) {
                    continue;
                }

                if (!this.anyRegexMatches(comment.author.name, group.usernameRegex)) {
                    continue;
                }
            }

            if (group.bioRegex) {
                if (!comment.author?.description) {
                    continue;
                }

                if (!this.anyRegexMatches(comment.author.description, group.bioRegex)) {
                    continue;
                }
            }

            if (group.maxCommentKarma !== undefined && comment.author?.karma !== undefined && comment.author.karma > group.maxCommentKarma) {
                continue;
            }

            if (group.maxLinkKarma !== undefined && comment.author?.karma !== undefined && comment.author.karma > group.maxLinkKarma) {
                continue;
            }

            if (!group.criteria) {
                continue;
            };

            const commentConditions: CommentCondition[] = this.collectCommentConditionsForPreEvalation(group.criteria);
            for (const condition of commentConditions) {
                const conditionMatches = await this.commentMatchesCondition(comment.comment, condition);
                if (!conditionMatches) {
                    continue;
                }
            }

            return true;
        }

        return false;
    }

    override async preEvaluateCommentEdit (event: CommentUpdate): Promise<boolean> {
        return this.preEvaluateComment(event);
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

        if (condition.isCrossPost !== undefined) {
            const isCrossPost = post.url.startsWith("/r/");
            if (isCrossPost !== condition.isCrossPost) {
                return false;
            }
        }

        return true;
    }

    private cachedPostTitles: Record<string, string> = {};

    private async getPostTitle (postId: string): Promise<string> {
        const localCachedTitle = this.cachedPostTitles[postId];
        if (localCachedTitle) {
            return localCachedTitle;
        }

        const cacheKey = `bbe~postTitle~${postId}`;
        const cachedPostTitle = await this.context.redis.get(cacheKey);
        if (cachedPostTitle) {
            this.cachedPostTitles[postId] = cachedPostTitle;
            return cachedPostTitle;
        }

        const post = await this.context.reddit.getPostById(postId);
        await this.context.redis.set(cacheKey, post.title, { expiration: addDays(new Date(), 1) });
        this.cachedPostTitles[postId] = post.title;
        return post.title;
    }

    private async commentMatchesCondition (comment: Comment | CommentV2, condition: CommentCondition, history?: (Post | Comment)[]): Promise<boolean> {
        if (!this.postOrCommentMatchesCondition(comment, condition)) {
            return false;
        }

        if (condition.postId && !condition.postId.some(postId => comment.postId === `t3_${postId}`)) {
            return false;
        }

        if (condition.isTopLevel !== undefined && condition.isTopLevel !== isLinkId(comment.parentId)) {
            return false;
        }

        if (condition.isCommentOnOwnPost !== undefined) {
            if (!history || !(comment instanceof Comment)) {
                return false;
            }
            const posts = this.getPosts(history);
            const parentPost = posts.find(post => post.id === comment.postId);
            return condition.isCommentOnOwnPost === (parentPost?.authorName === comment.authorName);
        }

        if (condition.postTitleRegex) {
            const postTitle = await this.getPostTitle(comment.postId);
            if (!this.anyRegexMatches(postTitle, condition.postTitleRegex)) {
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

        if (group.minCommentKarma && user.commentKarma < group.minCommentKarma) {
            this.setReason(`Comment karma below minimum in group ${group.name}`);
            return false;
        }

        if (group.minLinkKarma && user.linkKarma < group.minLinkKarma) {
            this.setReason(`Link karma below minimum in group ${group.name}`);
            return false;
        }

        if (group.nsfw !== undefined && user.nsfw !== group.nsfw) {
            this.setReason(`User is not marked as NSFW in group ${group.name}`);
            return false;
        }

        if (group.bioRegex) {
            if (!user.userDescription) {
                this.setReason(`User does not have a bio in group ${group.name}`);
                return false;
            }
            if (!this.anyRegexMatches(user.userDescription, group.bioRegex)) {
                this.setReason(`Bio does not match regex in group ${group.name}`);
                return false;
            }
        }

        if (group.displayNameRegex) {
            if (!user.displayName) {
                this.setReason(`User does not have a display name in group ${group.name}`);
                return false;
            }
            if (!this.anyRegexMatches(user.displayName, group.displayNameRegex)) {
                this.setReason(`Display name does not match regex in group ${group.name}`);
                return false;
            }
        }

        if (group.socialLinkRegex) {
            const userSocialLinks = await this.getSocialLinks(user.username);
            if (!userSocialLinks.some(userLink => group.socialLinkRegex && this.anyRegexMatches(userLink.outboundUrl, group.socialLinkRegex))) {
                this.setReason(`No matching social links found for user in group ${group.name}`);
                return false;
            }
        }

        if (group.socialLinkTitleRegex) {
            const userSocialLinks = await this.getSocialLinks(user.username);
            if (!userSocialLinks.some(userLink => group.socialLinkTitleRegex && userLink.title && this.anyRegexMatches(userLink.title, group.socialLinkTitleRegex))) {
                this.setReason(`No matching social link titles found for user in group ${group.name}`);
                return false;
            }
        }

        if (group.hasVerifiedEmail !== undefined && user.hasVerifiedEmail !== group.hasVerifiedEmail) {
            this.setReason(`User has verified email status does not match in group ${group.name}`);
            return false;
        }

        if (group.hasRedditPremium !== undefined && user.isGold !== group.hasRedditPremium) {
            this.setReason(`User has Reddit Premium status does not match in group ${group.name}`);
            return false;
        }

        if (group.isSubredditModerator !== undefined && user.isModerator !== group.isSubredditModerator) {
            this.setReason(`User is subreddit moderator status does not match in group ${group.name}`);
            return false;
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

    private async historyMatchesCriteriaGroup (history: (Post | Comment)[], criteria: CriteriaGroup): Promise<boolean> {
        if ("not" in criteria) {
            return !await this.historyMatchesCriteriaGroup(history, criteria.not);
        } else if ("every" in criteria) {
            return (await Promise.all(criteria.every.map(subCriteria => this.historyMatchesCriteriaGroup(history, subCriteria)))).every(Boolean);
        } else if ("some" in criteria) {
            return (await Promise.all(criteria.some.map(subCriteria => this.historyMatchesCriteriaGroup(history, subCriteria)))).some(Boolean);
        } else if ("type" in criteria) {
            if (criteria.type === "post") {
                const posts = this.getPosts(history);
                const matchingPosts = posts.filter(post => this.postMatchesCondition(post, criteria));
                const matchesNeeded = criteria.matchesNeeded ?? 1;
                if (matchingPosts.length < matchesNeeded) {
                    return false;
                } else {
                    return true;
                }
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (criteria.type === "comment") {
                const comments = this.getComments(history);
                const matchingComments = await Promise.all(comments.map(async comment => await this.commentMatchesCondition(comment, criteria, history)));
                const matchesNeeded = criteria.matchesNeeded ?? 1;
                if (compact(matchingComments).length < matchesNeeded) {
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
                const historyMatchesGroup = await this.historyMatchesCriteriaGroup(history, group.criteria);
                if (!historyMatchesGroup) {
                    this.setReason(`User does not match history criteria in group ${group.name}`);
                    continue;
                }
            }

            this.addHitReason(group.name);
        }

        return this.hitReasons !== undefined && this.hitReasons.length > 0;
    }
}
