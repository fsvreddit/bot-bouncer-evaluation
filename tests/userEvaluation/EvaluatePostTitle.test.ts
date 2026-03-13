import { Post, TriggerContext } from "@devvit/public-api";
import { EvaluatePostTitle } from "../../src/userEvaluation/EvaluatePostTitle";
import { UserExtended } from "../../src/extendedDevvit";

const variables = {
    "posttitle:bantext": [
        "free money",
        "work from home",
        "click here",
        "visit this link",
        "limited time offer",
        "act now",
    ],
};

function fakePostHistory (titles: string[]) {
    return titles.map((title, index) => ({
        title,
        createdAt: new Date(),
        id: `t3_post${index}`,
        nsfw: true,
        url: "https://example.com",
    } as unknown as Post));
}

test("Post title matches bannable regex", () => {
    const history = fakePostHistory([
        "this is a normal post",
        "click here for free money",
    ]);

    const evaluator = new EvaluatePostTitle({} as unknown as TriggerContext, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(result).toBe(true);
});

test("Post title does not match bannable regex", () => {
    const history = fakePostHistory([
        "this is a normal post",
        "another safe post",
    ]);

    const evaluator = new EvaluatePostTitle({} as unknown as TriggerContext, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended, history);
    expect(result).toBe(false);
});
