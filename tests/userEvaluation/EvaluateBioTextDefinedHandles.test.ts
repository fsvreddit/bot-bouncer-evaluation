import { JSONValue, TriggerContext } from "@devvit/public-api";
import { UserExtended } from "../../src/extendedDevvit";
import { subDays } from "date-fns";
import { EvaluateBioTextDefinedHandles } from "../../src/userEvaluation/EvaluateBioTextDefinedHandles";

const variables = JSON.parse(`{
    "substitutions:definedhandles": "handle1|handle2|handle3",
    "biotextdefinedhandles:prefix": "@",
    "biotextdefinedhandles:suffix": ""
}`) as Record<string, JSONValue>;

function createMockUser (bioText: string): UserExtended {
    return {
        id: "t2_fake",
        createdAt: subDays(new Date(), 10),
        username: "Wonderful-Lemon5828",
        userDescription: bioText,
        commentKarma: 350,
        linkKarma: 100,
        hasVerifiedEmail: true,
        isGold: false,
        isModerator: false,
        isAdmin: false,
        nsfw: true,
        displayName: "Wonderful-Lemon5828",
    };
}

test("User with matching bio text defined handle", () => {
    const evaluator = new EvaluateBioTextDefinedHandles({} as unknown as TriggerContext, undefined, variables);
    const mockUser = createMockUser("Hello, I am @handle2 and I love Reddit!");
    const result = evaluator.evaluate(mockUser, []);
    expect(result).toBeTruthy();
});

test("User with nonmatching bio text defined handle 1", () => {
    const evaluator = new EvaluateBioTextDefinedHandles({} as unknown as TriggerContext, undefined, variables);
    const mockUser = createMockUser("Hello, I am handle2 and I love Reddit!");
    const result = evaluator.evaluate(mockUser, []);
    expect(result).toBeFalsy();
});

test("User with nonmatching bio text defined handle 2", () => {
    const evaluator = new EvaluateBioTextDefinedHandles({} as unknown as TriggerContext, undefined, variables);
    const mockUser = createMockUser("Hello, I am @handle5 and I love Reddit!");
    const result = evaluator.evaluate(mockUser, []);
    expect(result).toBeFalsy();
});

test("User with nonmatching bio text defined handle 3", () => {
    const evaluator = new EvaluateBioTextDefinedHandles({} as unknown as TriggerContext, undefined, variables);
    const mockUser = createMockUser("A very ordinary Redditor with no special interests.");
    const result = evaluator.evaluate(mockUser, []);
    expect(result).toBeFalsy();
});
