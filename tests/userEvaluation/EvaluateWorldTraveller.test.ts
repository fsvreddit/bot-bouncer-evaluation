import { JSONValue, Post, TriggerContext } from "@devvit/public-api";
import { EvaluateWorldTraveller } from "../../src/userEvaluation/EvaluateWorldTraveller.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";

const variables: Record<string, JSONValue> = {
    "worldtraveler:killswitch": false,
    "worldtraveler:distinctgroups": 2,
    "worldtraveler:subgroups": [
        "CasualUK, unitedkingdom, uknews",
        "canada, ontario",
    ],
};

function createMockHistory (subreddits: string[]): Post[] {
    return subreddits.map(subreddit => ({
        subredditName: subreddit,
        id: `t3_${subreddit}`,
        createdAt: new Date(),
    } as unknown as Post));
}

test("Content in more than one group", () => {
    const history = createMockHistory(["CasualUK", "canada"]);
    const evaluator = new EvaluateWorldTraveller({} as unknown as TriggerContext, history, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended);
    expect(result).toBe(true);
});

test("Content in one group", () => {
    const history = createMockHistory(["CasualUK", "uknews"]);
    const evaluator = new EvaluateWorldTraveller({} as unknown as TriggerContext, history, undefined, variables);
    const result = evaluator.evaluate({} as unknown as UserExtended);
    expect(result).toBe(false);
});
