import { JSONValue, Post, TriggerContext } from "@devvit/public-api";
import { EvaluateInconsistentGenderBot } from "../../src/userEvaluation/EvaluateInconsistentGenderBot.js";
import { UserExtended } from "../../src/extendedDevvit.js";

const mockContext = {} as unknown as TriggerContext;

const mockVariables: Record<string, JSONValue> = {
    "inconsistentgender:genderregexes": [
        "^(?:18|19|[2-5]\\d)(?: ?\\[)?([MF])(?:4[FMART])\\b",
        "^([MF])(?:18|19|[2-5]\\d)",
        "^(?:18|19|[2-5]\\d)(M|F(?!b|tM))",
    ],
};

test("User with consistent genders", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
        id: `t3_fake_${i}`,
        createdAt: new Date(),
        title: "M19",
        subredditName: "findsnapchat",
        url: `https://www.reddit.com/r/findsnapchat/comments/t3_fake_${i}`,
        isNsfw: () => true,
    })) as unknown as Post[];

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, mockVariables);
    const evaluationResult = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(evaluationResult).toBeFalsy();
});

test("User with inconsistent genders", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
        id: `t3_fake_${i}`,
        createdAt: new Date(),
        title: "M19",
        subredditName: "findsnapchat",
        url: `https://www.reddit.com/r/findsnapchat/comments/t3_fake_${i}`,
        isNsfw: () => true,
    })) as unknown as Post[];

    history.push({
        id: "t3_fake_7",
        createdAt: new Date(),
        title: "20 [F4M]",
        subredditName: "findsnapchat",
        url: "https://www.reddit.com/r/findsnapchat/comments/t3_fake_7",
        isNsfw: () => true,
    } as unknown as Post);

    history.push({
        id: "t3_fake_8",
        createdAt: new Date(),
        title: "20 [F4M]",
        subredditName: "findsnapchat",
        url: "https://www.reddit.com/r/findsnapchat/comments/t3_fake_8",
        isNsfw: () => true,
    } as unknown as Post);

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, mockVariables);
    const evaluationResult = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(evaluationResult).toBeTruthy();
});

test("Regex formats", () => {
    const testCases = [
        { title: "M19", expected: "M" },
        { title: "F23", expected: "F" },
        { title: "18 [F4M]", expected: "F" },
        { title: "20 [M4F]", expected: "M" },
        { title: "19F", expected: "F" },
        { title: "23M", expected: "M" },
    ];

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, mockVariables);

    for (const { title, expected } of testCases) {
        const result = evaluator.getGenderFromTitle(title);
        if (result !== expected) {
            assert.fail(`Expected "${expected}" but got "${result}" for title "${title}"`);
        }
    }
});

test("Validation fails if no capturing group found", () => {
    const variables = {
        "inconsistentgender:genderregexes": [
            "^F\\s?(18|19|[2-4][0-9])(?![$+])",
            "F(?:[0-9]{2})",
        ],
    };

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, variables);
    const results = evaluator.validateVariables();
    expect(results.length).toBe(1);
});
