import { subDays } from "date-fns";
import { UserExtended } from "../../src/extendedDevvit";
import { EvaluateBotGroupAdvanced } from "../../src/userEvaluation/EvaluateBotGroupAdvanced";
import { yamlToVariables } from "../../src/utility";
import { Comment, Post, TriggerContext } from "@devvit/public-api";

test("Simple account properties evaluation", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    usernameRegex:
        - '^testuser'
    bioRegex:
        - '^Julie, 19'
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, []);
    expect(evaluationResult).toBe(true);
});

test("Simple criteria", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
        { subredditName: "AITAH", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("And Criteria", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        every:
            - type: post
              age:
                maxAgeInDays: 30
              subredditName:
                - Frieren
              titleRegex:
                - ^Test
            - type: comment
              age:
                maxAgeInDays: 30
              subredditName:
                - AITAH
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
        { subredditName: "AITAH", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Or Criteria", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        some:
            - type: post
              age:
                maxAgeInDays: 30
              subredditName:
                - Frieren
              titleRegex:
                - ^Test
            - type: comment
              age:
                maxAgeInDays: 30
              subredditName:
                - AITAH
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "AITAH", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Not Criteria returns false", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        every:
            - type: post
              age:
                maxAgeInDays: 30
              subredditName:
                - Frieren
              titleRegex:
                - ^Test
            - not:
                type: comment
                age:
                    maxAgeInDays: 30
                subredditName:
                  - AITAH
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
        { subredditName: "AITAH", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Not Criteria returns true", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        every:
            - type: post
              age:
                maxAgeInDays: 30
              subredditName:
                - Frieren
                - Hentai
              titleRegex:
                - ^Test
            - not:
                type: comment
                subredditName:
                  - AskReddit
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
        { subredditName: "AITAH", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Min items criteria matches", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        matchesNeeded: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test

`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_234", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Min items criteria does not match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        matchesNeeded: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Badly formed YAML", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        matchesNeeded: 2
        age:
        maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Not subredditName criteria with comment in the sub", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: comment
        matchesNeeded: 1
        age:
            maxAgeInDays: 30
        notSubredditName:
            - Frieren
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Not subredditName criteria with comment outside the sub", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: comment
        matchesNeeded: 1
        age:
            maxAgeInDays: 30
        notSubredditName:
            - Frieren
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Regex as string not array", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: BangHorna etc. low karma accounts
    maxCommentKarma: 200
    criteria:
        type: comment
        age:
            maxAgeInDays: 90
        bodyRegex: '[A-Z][a-z]{3,}.?(?:[Oo]onga|[Hh]oonga|[Hh]orna|[Ww]inko).+AI'
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(1);
});

test("False positives", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: BangHorna etc. low karma accounts
    maxCommentKarma: 200
    criteria:
        type: comment
        age:
            maxAgeInDays: 90
        bodyRegex:
            - '[A-Z][a-z]{3,6}[^a-z]?(?:[Oo]onga|[Hh]oonga|[Hh]orna|[Ww]inko)'

`;

    const user = {
        username: "testuser43",
        commentKarma: 50,
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", postId: "t3_123", parentId: "t1_123", body: "Test Body" } as unknown as Comment,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Body regex match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: BangHorna etc. low karma accounts
    maxCommentKarma: 200
    criteria:
        type: comment
        age:
            maxAgeInDays: 90
        bodyRegex:
            - '[A-Z][a-z]{3,6}[^a-z]?(?:[Oo]onga|[Hh]oonga|[Hh]orna|[Ww]inko)'

`;

    const user = {
        username: "testuser43",
        commentKarma: 50,
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", postId: "t3_123", parentId: "t1_123", body: "LoveHoonga is great for AI girlfriends" } as unknown as Comment,
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Doc Ava false positive avoidance", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group4:
    name: Doc Ava # Failsafe where they have no NSFW content
    maxCommentKarma: 50
    age:
        maxAgeInDays: 28
    bioRegex:
        - 'fieryava'
        - 'avafiery'
`;

    const user = {
        username: "testuser43",
        commentKarma: 5,
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", postId: "t3_123", parentId: "t1_123", body: "LoveHoonga is great for AI girlfriends" } as unknown as Comment,
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Doc Ava false positive avoidance 2", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group4:
    name: Doc Ava # Failsafe where they have no NSFW content
    maxCommentKarma: 50
    age:
        maxAgeInDays: 28
    bioRegex:
        - 'fieryava'
        - 'avafiery'
`;

    const user = {
        username: "testuser43",
        commentKarma: 5,
        createdAt: subDays(new Date(), 20),
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", postId: "t3_123", parentId: "t1_123", body: "LoveHoonga is great for AI girlfriends" } as unknown as Comment,
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Doc Ava correct match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group4:
    name: Doc Ava # Failsafe where they have no NSFW content
    maxCommentKarma: 50
    age:
        maxAgeInDays: 28
    bioRegex:
        - 'fieryava'
        - 'avafiery'
`;

    const user = {
        username: "testuser43",
        commentKarma: 5,
        createdAt: subDays(new Date(), 20),
        userDescription: "40F, Doctor. Find me on my link below! fieryava",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Hentai", createdAt: subDays(new Date(), 1), id: "t1_123", authorName: "testuser43", postId: "t3_123", parentId: "t1_123", body: "LoveHoonga is great for AI girlfriends" } as unknown as Comment,
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Test Body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    console.log(evaluator.getReasons());
    expect(evaluationResult).toBe(true);
});

test("minBodyLength criteria matches", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        minBodyLength: 10
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a valid body" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("minBodyLength criteria does not match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        minBodyLength: 10
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "Short" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("maxBodyLength criteria matches", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        maxBodyLength: 50
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a valid body that is not too long" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("maxBodyLength criteria does not match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        maxBodyLength: 50
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a very long body that exceeds the maximum length set in the criteria" } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("minParaCount criteria matches", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        minParaCount: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a valid body.\nIt has multiple paragraphs." } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("minParaCount criteria does not match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        minParaCount: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a single paragraph." } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("maxParaCount criteria matches", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        maxParaCount: 3
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a valid body.\nIt has multiple paragraphs.\nBut not too many." } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("maxParaCount criteria does not match", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        type: post
        maxParaCount: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - Frieren
        titleRegex:
            - ^Test
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const history = [
        { subredditName: "Frieren", createdAt: subDays(new Date(), 1), id: "t3_123", authorName: "testuser43", title: "Test Post", body: "This is a body with too many paragraphs.\nIt has multiple paragraphs.\nAnd even more paragraphs.\nThis should not match." } as unknown as Post,
    ];

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Validate string array", () => {
    const yaml = `
name: substitutions

memesubs:
    - artmemes
    - dankmemes

---
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    criteria:
        type: post
        maxParaCount: 2
        age:
            maxAgeInDays: 30
        subredditName:
            - {{memesubs}}

`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(1);
});

test("Validate invalid criteria with multiple boolean operators", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        every:
            - type: post
        some:
            - type: comment
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Validate invalid criteria with array of criteria", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        - type: post
        - type: comment
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Validate invalid criteria with empty every condition", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        every:
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Validate invalid criteria with empty some condition", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        some:
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Validate invalid criteria with empty not condition", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    age:
        maxAgeInDays: 30
    criteria:
        not:
`;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Max Comment Karma check returns false with more karma", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    maxCommentKarma: 100

`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        commentKarma: 150,
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, []);
    expect(evaluationResult).toBe(false);
});

test("Max Comment Karma check returns true with less karma", async () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    maxCommentKarma: 100
`;

    const user = {
        username: "testuser43",
        createdAt: subDays(new Date(), 20),
        commentKarma: 50,
        userDescription: "Julie, 19! Find me on my link below!",
    } as unknown as UserExtended;

    const variables = yamlToVariables(yaml);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, []);
    expect(evaluationResult).toBe(true);
});

test("Validate indented criteria", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:
    name: Test Group
    maxCommentKarma: 100
      criteria:
        type: comment
`;

    const variables = yamlToVariables(yaml);
    console.log(variables);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(1);
});

test("Validate empty groups", () => {
    const yaml = `
name: botgroupadvanced
killswitch: false

group1:

group2:
    name: Test Group
    criteria:
        type: comment
`;

    const variables = yamlToVariables(yaml);
    console.log(variables);
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, undefined, variables);
    const errors = evaluator.validateVariables();
    console.log(errors);
    expect(errors.length).toEqual(1);
});
