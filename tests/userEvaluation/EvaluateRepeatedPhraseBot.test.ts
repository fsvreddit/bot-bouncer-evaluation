import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { EvaluateRepeatedPhraseBot } from "../../src/userEvaluation/EvaluateRepeatedPhraseBot.js";
import { UserExtended } from "../../src/extendedDevvit.js";
import { subYears } from "date-fns";

const mockTriggerContext = {} as unknown as TriggerContext;
const mockUser = {} as unknown as UserExtended;

const variables = {
    "repeatedphrase:phrases": ["TheProduct"],
    "repeatedphrase:casesensitive": false,
};

const mockHistory = [
    {
        createdAt: new Date(),
        id: "t1_fake",
        body: "TheProduct is great!",
    }, {
        createdAt: new Date(),
        id: "t1_fake2",
        body: "You should buy TheProduct, it is awesome!",
    }, {
        createdAt: new Date(),
        id: "t1_fake3",
        body: "TheProduct is the best!",
    }, {
        createdAt: new Date(),
        id: "t1_fake4",
        body: "TheProduct is amazing!",
    },
] as unknown as Comment[];

test("User with every recent comment matching the phrase", () => {
    const evaluator = new EvaluateRepeatedPhraseBot(mockTriggerContext, undefined, variables);
    const result = evaluator.evaluate(mockUser, mockHistory);
    expect(result).toBeTruthy();
});

test("User with a recent mismatching comment matching the phrase", () => {
    const evaluator = new EvaluateRepeatedPhraseBot(mockTriggerContext, undefined, variables);
    const history = [
        ...mockHistory,
        {
            createdAt: new Date(),
            id: "t1_fake5",
            body: "This is a test comment.",
        },
    ] as unknown as Comment[];

    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeFalsy();
});

test("User with a recent post", () => {
    const evaluator = new EvaluateRepeatedPhraseBot(mockTriggerContext, undefined, variables);
    const history = [
        ...mockHistory,
        {
            createdAt: new Date(),
            id: "t3_fake",
            body: "This is a test post.",
        } as unknown as Post,
    ] as unknown as (Comment | Post)[];

    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeFalsy();
});

test("User with an old recent post", () => {
    const evaluator = new EvaluateRepeatedPhraseBot(mockTriggerContext, undefined, variables);
    const history = [
        ...mockHistory,
        {
            createdAt: subYears(new Date(), 1),
            id: "t3_fake",
            body: "This is a test post.",
        } as unknown as Post,
    ] as unknown as (Comment | Post)[];

    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeTruthy();
});

test("User with insufficient history", () => {
    const evaluator = new EvaluateRepeatedPhraseBot(mockTriggerContext, undefined, variables);
    const history = mockHistory.slice(0, 2) as unknown as Comment[];

    const result = evaluator.evaluate(mockUser, history);
    expect(result).toBeFalsy();
});
