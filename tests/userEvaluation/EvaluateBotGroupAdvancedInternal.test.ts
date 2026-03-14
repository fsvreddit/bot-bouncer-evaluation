import { TriggerContext } from "@devvit/public-api";
import { EvaluateBotGroupAdvancedInternal } from "../../src/userEvaluation/EvaluateBotGroupAdvancedInternal";
import { yamlToVariables } from "../../src/utility";
import { UserExtended } from "../../src/extendedDevvit";

const fakeContext: TriggerContext = {
    reddit: {
        subredditName: "testsubreddit",
        // eslint-disable-next-line @typescript-eslint/require-await
        getCurrentSubredditName: async () => "testsubreddit",
    },
} as unknown as TriggerContext;

test("Default username regex criteria permitted on Bot Group Advanced Internal", () => {
    const yaml = `
name: botgroupadvancedinternal
killswitch: false

defaultUsernameRegex: '^(?:[A-Z][a-z]+[_-]?){2}\\d{3,4}$'

group1:
    name: Test Group
    matchesDefaultUsernameRegex: true
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvancedInternal(fakeContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);
});

function createFakeUser (username: string): UserExtended {
    return {
        username,
        commentKarma: 0,
        linkKarma: 0,
        createdAt: new Date(),
        hasVerifiedEmail: true,
        id: "t2_12345",
        isAdmin: false,
        isGold: false,
        isModerator: false,
        nsfw: false,
    };
}

test("Default username regex matches autogen user", async () => {
    const yaml = `name: botgroupadvancedinternal
killswitch: false

defaultUsernameRegex: '^(?:[A-Z][a-z]+[_-]?){2}\\d{3,4}$'

group1:
    name: Test Group
    matchesDefaultUsernameRegex: true
`;

    const fakeUser: UserExtended = createFakeUser("Adjective_Noun1234");

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvancedInternal(fakeContext, undefined, variables);
    const preEvaluateResult = await evaluator.preEvaluateUser(fakeUser);
    expect(preEvaluateResult).toEqual(true);
});

test("Default username regex does not match non-autogen user", async () => {
    const yaml = `name: botgroupadvancedinternal
killswitch: false

defaultUsernameRegex: '^(?:[A-Z][a-z]+[_-]?){2}\\d{3,4}$'

group1:
    name: Test Group
    matchesDefaultUsernameRegex: true
`;

    const fakeUser = createFakeUser("spez");

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvancedInternal(fakeContext, undefined, variables);
    const preEvaluateResult = await evaluator.preEvaluateUser(fakeUser);
    expect(preEvaluateResult).toEqual(false);
});
