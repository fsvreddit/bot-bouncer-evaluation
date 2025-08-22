import { JSONValue, Post, TriggerContext } from "@devvit/public-api";
import { UserExtended } from "../../src/types.js";
import { EvaluateInconsistentAgeBot } from "../../src/userEvaluation/EvaluateInconsistentAgeBot.js";

const mockContext = {} as unknown as TriggerContext;
const mockBasicHistory = [
    { createdAt: new Date(), id: "t3_fake1", subredditName: "gonewild", title: "Post 1", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake2", subredditName: "gonewild", title: "Post 2", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake3", subredditName: "gonewild", title: "Post 3", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake4", subredditName: "gonewild", title: "Post 4", isNsfw: () => true },
    { createdAt: new Date(), id: "t3_fake5", subredditName: "gonewild", title: "Post 5", isNsfw: () => true },
] as unknown as Post[];

const mockUser = {} as unknown as UserExtended;

const mockVariables = {} as unknown as Record<string, JSONValue>;

test("User with three different sequential ages", () => {
    const history = [
        ...mockBasicHistory,
        { createdAt: new Date(), id: "t3_fake6", subredditName: "gonewild", title: "F23 Hello", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake7", subredditName: "gonewild", title: "F24 Hello", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake8", subredditName: "gonewild", title: "F25 Hello", isNsfw: () => true },
    ] as unknown as Post[];

    const evaluator = new EvaluateInconsistentAgeBot(mockContext, undefined, mockVariables);
    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeTruthy();
});

test("Male user with three different sequential ages", () => {
    const history = [
        ...mockBasicHistory,
        { createdAt: new Date(), id: "t3_fake6", subredditName: "gonewild", title: "M23 Hello", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake7", subredditName: "gonewild", title: "24M Hello", isNsfw: () => true },
        { createdAt: new Date(), id: "t3_fake8", subredditName: "gonewild", title: "M25 Hello", isNsfw: () => true },
    ] as unknown as Post[];

    const evaluator = new EvaluateInconsistentAgeBot(mockContext, undefined, mockVariables);
    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeFalsy();
});
