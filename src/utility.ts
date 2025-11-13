import { JSONValue, TriggerContext, User } from "@devvit/public-api";
import { parseAllDocuments } from "yaml";

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

export function yamlToVariables (input: string): Record<string, JSONValue> {
    const substitutionsList = getSubstitutionsListFromYaml(input);
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

    const yamlDocuments = parseAllDocuments(yaml, { uniqueKeys: true });

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

        if (doc.errors.length > 0) {
            if (doc.errors.some(e => e.code === "DUPLICATE_KEY")) {
                errors.push(`Module name ${root} has duplicate keys`);
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
