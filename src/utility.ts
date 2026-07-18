import { JSONValue, TriggerContext, User } from "@devvit/public-api";
import { getUserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { addMinutes } from "date-fns";
import { Document, Node, parseAllDocuments, Scalar, YAMLMap } from "yaml";

export async function getUserOrUndefined (username: string, context: TriggerContext): Promise<User | undefined> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }
    return user;
}

function getSubstitutionsListFromYaml (yaml: string): Record<string, string | string[]> {
    const yamlDocuments = parseAllDocuments(yaml);
    const substitutions: Record<string, string | string[]> = {};

    for (const document of yamlDocuments) {
        const json = document.toJSON() as Record<string, JSONValue> | null;
        if (json?.name !== "substitutions") {
            continue;
        }

        for (const key in json) {
            if (key !== "name") {
                substitutions[key] = json[key] as string | string[];
            }
        }
    }

    return substitutions;
}

export interface DuplicateKeyInfo {
    key: string;
    path: string;
    line: number;
    col: number;
}

export function findDuplicateKeysInDoc (doc: Document.Parsed): DuplicateKeyInfo[] {
    const duplicates: DuplicateKeyInfo[] = [];

    function walk (node: Node | null, path: string[]) {
    // Only YAMLMap nodes have .items
        if (!(node instanceof YAMLMap)) {
            return;
        }

        const seen = new Map<string, boolean>();

        for (const pair of node.items) {
            const keyNode = pair.key as Scalar | null;
            const key = keyNode?.value;

            if (typeof key !== "string") {
                continue;
            }

            const childPath = [...path, key];

            if (seen.has(key)) {
                const [line, col] = keyNode?.range ?? [0, 0];

                duplicates.push({
                    key,
                    path: childPath.join("."),
                    line,
                    col,
                });
            } else {
                seen.set(key, true);
            }

            walk(pair.value as Node | null, childPath);
        }
    }

    walk(doc.contents, []);
    return duplicates;
}

export function yamlToVariables (input: string, extraSubstitutions: Record<string, string | string[]> = {}): Record<string, JSONValue> {
    const substitutionsList = { ...getSubstitutionsListFromYaml(input), ...extraSubstitutions };
    let yaml = input;
    for (const key in substitutionsList) {
        if (typeof substitutionsList[key] === "string") {
            yaml = yaml.replaceAll(`{{${key}}}`, substitutionsList[key]);
        } else {
            // Handle array substitutions
            yaml = yaml.replaceAll(`{{${key}}}`, JSON.stringify(substitutionsList[key]));
        }
    }

    const variables: Record<string, JSONValue> = {};

    const yamlDocuments = parseAllDocuments(yaml);

    const modulesSeen = new Set<string>();
    const errors: string[] = [];

    let index = 0;
    for (const doc of yamlDocuments) {
        const json = doc.toJSON() as Record<string, JSONValue> | null;
        if (!json) {
            // Empty document
            continue;
        }

        const root = json.name as string | undefined;
        if (!root) {
            console.error(`Evaluator Variables: Error parsing evaluator variables from wiki. Missing root name on document ${index}.`);
            continue;
        }

        const duplicates = findDuplicateKeysInDoc(doc);
        if (duplicates.length > 0) {
            for (const duplicate of duplicates) {
                const error = `Duplicate key "${duplicate.key}" found at path "${duplicate.path}" in module "${root}".`;
                errors.push(error);
            }
        }

        if (modulesSeen.has(root)) {
            errors.push(`Module name ${root} is present more than once`);
        } else {
            modulesSeen.add(root);
        }

        for (const key in json) {
            if (key !== "name") {
                variables[`${root}:${key}`] = json[key];
            }
        }

        index++;
    }

    variables.errors = errors;

    return variables;
}

interface AdditionalUserInfoSerialized {
    createdAt: number;
    userDescription?: string;
    displayName?: string;
    nsfw: boolean;
    commentKarma: number;
    linkKarma: number;
    hasRedditPremium: boolean;
    hasVerifiedEmail: boolean;
    isSubredditModerator: boolean;
}

export interface AdditionalUserInfo {
    createdAt: Date;
    userDescription?: string;
    displayName?: string;
    nsfw: boolean;
    commentKarma: number;
    linkKarma: number;
    hasRedditPremium: boolean;
    hasVerifiedEmail: boolean;
    isSubredditModerator: boolean;
}

export interface AdditionalUserInfo {
    createdAt: Date;
    userDescription?: string;
    displayName?: string;
    nsfw: boolean;
    commentKarma: number;
    linkKarma: number;
    hasRedditPremium: boolean;
    hasVerifiedEmail: boolean;
    isSubredditModerator: boolean;
}

export async function getAdditionalUserInfo (username: string, context: TriggerContext): Promise<AdditionalUserInfo | undefined> {
    const cacheKey = `bbe:additionalUserInfo:${username}`;
    const cachedData = await context.redis.get(cacheKey);

    if (cachedData) {
        const parsedData = JSON.parse(cachedData) as AdditionalUserInfoSerialized;
        return {
            createdAt: new Date(parsedData.createdAt),
            userDescription: parsedData.userDescription,
            displayName: parsedData.displayName,
            nsfw: parsedData.nsfw,
            commentKarma: parsedData.commentKarma,
            linkKarma: parsedData.linkKarma,
            hasRedditPremium: parsedData.hasRedditPremium,
            hasVerifiedEmail: parsedData.hasVerifiedEmail,
            isSubredditModerator: parsedData.isSubredditModerator,
        };
    }

    const user = await getUserExtended(username, context);
    if (!user) {
        return;
    }

    const dataToCache: AdditionalUserInfoSerialized = {
        createdAt: user.createdAt.getTime(),
        userDescription: user.userDescription,
        displayName: user.displayName,
        nsfw: user.nsfw,
        commentKarma: user.commentKarma,
        linkKarma: user.linkKarma,
        hasRedditPremium: user.isGold,
        hasVerifiedEmail: user.hasVerifiedEmail,
        isSubredditModerator: user.isModerator,
    };

    await context.redis.set(cacheKey, JSON.stringify(dataToCache), { expiration: addMinutes(new Date(), 10) });

    return {
        createdAt: user.createdAt,
        userDescription: user.userDescription,
        displayName: user.displayName,
        nsfw: user.nsfw,
        commentKarma: user.commentKarma,
        linkKarma: user.linkKarma,
        hasRedditPremium: user.isGold,
        hasVerifiedEmail: user.hasVerifiedEmail,
        isSubredditModerator: user.isModerator,
    };
}
