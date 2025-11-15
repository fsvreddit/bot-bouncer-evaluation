import { Post, TriggerContext } from "@devvit/public-api";
import { EvaluatePostTitleMulti } from "../../src/userEvaluation/EvaluatePostTitleMulti";
import { UserExtended } from "../../src/extendedDevvit";

const variables = {
    "posttitlemulti:regexes": [
        "free money",
        "work from home",
        "click here",
        "visit this link",
        "limited time offer",
        "act now",
    ],
    "posttitlemulti:matchesNeeded": 4,
};

function fakePostHistory (titles: string[]) {
    return titles.map((title, index) => ({
        title,
        createdAt: new Date(),
        id: `t3_post${index}`,
        nsfw: true,
    } as unknown as Post));
}

test("Insufficient Matches", () => {
    const history = fakePostHistory([
        "this is a normal post",
        "want free money? follow my link!",
        "limited time offer just for you",
        "act now to claim your prize",
    ]);

    const evaluator = new EvaluatePostTitleMulti({} as unknown as TriggerContext, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(result).toBe(false);
});

test("Sufficient matches", () => {
    const history = fakePostHistory([
        "this is a normal post",
        "click here for free money",
        "limited time offer just for you",
        "act now to claim your prize",
        "work from home and earn cash",
        "please visit this link to learn more",
    ]);

    const evaluator = new EvaluatePostTitleMulti({} as unknown as TriggerContext, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(result).toBe(true);
});

test("Validate regex starts with anchor", () => {
    const variables = {
        "posttitlemulti:regexes": [
            "free money",
            "^work from home",
        ],
    };

    const evaluator = new EvaluatePostTitleMulti({} as unknown as TriggerContext, undefined, variables);
    const results = evaluator.validateVariables();
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
        severity: "warning",
        message: "Regex must be anchored to start with `^`: free money",
    });
});
