import { JSONValue, TriggerContext, User } from "@devvit/public-api";
import { parseAllDocuments } from "yaml";

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

export async function getUserOrUndefined (username: string, context: TriggerContext): Promise<User | undefined> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }
    return user;
}

function getSubstitutionsListFromYaml (yaml: string): Record<string, string> {
    const yamlDocuments = parseAllDocuments(yaml);
    const substitutions: Record<string, string> = {};

    for (const document of yamlDocuments) {
        const json = document.toJSON() as Record<string, JSONValue> | null;
        if (!json || json.name !== "substitutions") {
            continue;
        }

        for (const key in json) {
            if (key !== "name") {
                substitutions[key] = json[key] as string;
            }
        }
    }

    return substitutions;
}

export function yamlToVariables (input: string): Record<string, JSONValue> {
    const substitutionsList = getSubstitutionsListFromYaml(input);
    let yaml = input;
    for (const key in substitutionsList) {
        yaml = replaceAll(yaml, `{{${key}}}`, substitutionsList[key]);
    }

    const yamlDocuments = parseAllDocuments(yaml);
    const variables: Record<string, JSONValue> = {};

    const modulesSeen = new Set<string>();

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

        if (modulesSeen.has(root)) {
            console.warn(`Evaluator Variables: Module name ${root} is present more than once. This is not permitted.`);
            modulesSeen.add(root);
        }

        for (const key in json) {
            if (key !== "name") {
                variables[`${root}:${key}`] = json[key];
            }
        }

        index++;
    }

    return variables;
}
