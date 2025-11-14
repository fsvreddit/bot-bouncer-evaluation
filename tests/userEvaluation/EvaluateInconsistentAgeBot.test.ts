import { JSONValue, Post, TriggerContext } from "@devvit/public-api";
import { UserExtended } from "../../src/extendedDevvit.js";
import { EvaluateInconsistentAgeBot } from "../../src/userEvaluation/EvaluateInconsistentAgeBot.js";

const mockContext = {} as unknown as TriggerContext;
const mockBasicHistory = [
    { createdAt: new Date(), id: "t3_fake1", subredditName: "gonewild", title: "Post 1", url: "https://www.reddit.com/r/gonewild/comments/t3_fake1", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake2", subredditName: "gonewild", title: "Post 2", url: "https://www.reddit.com/r/gonewild/comments/t3_fake2", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake3", subredditName: "gonewild", title: "Post 3", url: "https://www.reddit.com/r/gonewild/comments/t3_fake3", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake4", subredditName: "gonewild", title: "Post 4", url: "https://www.reddit.com/r/gonewild/comments/t3_fake4", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake5", subredditName: "gonewild", title: "Post 5", url: "https://www.reddit.com/r/gonewild/comments/t3_fake5", isNsfw: () => true },
] as unknown as Post[];

const mockUser = {} as unknown as UserExtended;

const mockVariables: Record<string, JSONValue> = {
    "inconsistentage:contentthreshold": 4,
    "inconsistentage:ageregexes": [
        "^F\\s?(18|19|[2-4][0-9])(?![$+])",
        "^(18|19|[2-4][0-9])\\s?F",
        "^(18|19|[2-4][0-9]) \\[F",
    ],
};

test("User with three different sequential ages", () => {
    const history = [
        ...mockBasicHistory,
        { createdAt: new Date(), id: "t3_fake6", subredditName: "gonewild", title: "F23 Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake6", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake7", subredditName: "gonewild", title: "F24 Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake7", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake8", subredditName: "gonewild", title: "F25 Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake8", isNsfw: () => true },
    ] as unknown as Post[];

    const evaluator = new EvaluateInconsistentAgeBot(mockContext, undefined, mockVariables);
    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeTruthy();
});

test("Male user with three different sequential ages", () => {
    const history = [
        ...mockBasicHistory,
        { createdAt: new Date(), id: "t3_fake6", subredditName: "gonewild", title: "M23 Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake6", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake7", subredditName: "gonewild", title: "24M Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake7", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake8", subredditName: "gonewild", title: "M25 Hello", url: "https://www.reddit.com/r/gonewild/comments/t3_fake8", isNsfw: () => true },
    ] as unknown as Post[];

    const evaluator = new EvaluateInconsistentAgeBot(mockContext, undefined, mockVariables);
    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeFalsy();
});

test("Validation fails if no capturing group found", () => {
    const variables = {
        "inconsistentage:ageregexes": [
            "^F\\s?(18|19|[2-4][0-9])(?![$+])",
            "F(?:[0-9]{2})",
        ],
    };

    const evaluator = new EvaluateInconsistentAgeBot(mockContext, undefined, variables);
    const results = evaluator.validateVariables();
    expect(results.length).toBe(1);
});
