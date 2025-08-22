import { Post, TriggerContext } from "@devvit/public-api";
import { EvaluateInconsistentGenderBot } from "../../src/userEvaluation/EvaluateInconsistentGenderBot.js";
import { UserExtended } from "../../src/types.js";

const mockContext = {} as unknown as TriggerContext;

test("User with consistent genders", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
        id: `t3_fake_${i}`,
        createdAt: new Date(),
        title: "M19",
        subredditName: "findsnapchat",
        isNsfw: () => true,
    })) as unknown as Post[];

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, {});
    const evaluationResult = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(evaluationResult).toBeFalsy();
});

test("User with inconsistent genders", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
        id: `t3_fake_${i}`,
        createdAt: new Date(),
        title: "M19",
        subredditName: "findsnapchat",
        isNsfw: () => true,
    })) as unknown as Post[];

    history.push({
        id: "t3_fake_7",
        createdAt: new Date(),
        title: "20 [F4M]",
        subredditName: "findsnapchat",
        isNsfw: () => true,
    } as unknown as Post);

    history.push({
        id: "t3_fake_8",
        createdAt: new Date(),
        title: "20 [F4M]",
        subredditName: "findsnapchat",
        isNsfw: () => true,
    } as unknown as Post);

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, {});
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

    const evaluator = new EvaluateInconsistentGenderBot(mockContext, undefined, {});

    for (const { title, expected } of testCases) {
        const result = evaluator.getGenderFromTitle(title);
        if (result !== expected) {
            assert.fail(`Expected "${expected}" but got "${result}" for title "${title}"`);
        }
    }
});
