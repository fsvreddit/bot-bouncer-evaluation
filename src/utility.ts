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

export function yamlToVariables (input: string): Record<string, JSONValue> {
    const yamlDocuments = parseAllDocuments(input);
    const variables: Record<string, JSONValue> = {};

    const modulesSeen = new Set<string>();

    const substitutions: Record<string, string> = {};

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

        // Special case: if in "substitutions" module, add to substitutions map
        if (root === "substitutions") {
            for (const key in json) {
                if (key === "name") {
                    continue;
                }
                substitutions[key] = json[key] as string;
            }
        }

        if (modulesSeen.has(root)) {
            console.warn(`Evaluator Variables: Module name ${root} is present more than once. This is not permitted.`);
            modulesSeen.add(root);
        }

        for (const key in json) {
            if (key !== "name") {
                let value = json[key];
                if (typeof value === "string") {
                    for (const subKey in substitutions) {
                        value = replaceAll(value, `{{${subKey}}}`, substitutions[subKey]);
                    }
                } else if (Array.isArray(value)) {
                    value = value.map((item) => {
                        if (typeof item === "string") {
                            for (const subKey in substitutions) {
                                item = replaceAll(item, `{{${subKey}}}`, substitutions[subKey]);
                            }
                        }
                        return item;
                    });
                }

                variables[`${root}:${key}`] = value;
            }
        }

        index++;
    }

    return variables;
}
