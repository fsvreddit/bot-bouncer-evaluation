import { subDays } from "date-fns";
import { UserExtended } from "../../src/types";
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
            - '[A-Z][a-z]{3,}.?(?:[Oo]onga|[Hh]oonga|[Hh]orna|[Ww]inko).+AI'

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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
            - '[A-Z][a-z]{3,}.?(?:[Oo]onga|[Hh]oonga|[Hh]orna|[Ww]inko).+AI'

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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
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
    const evaluator = new EvaluateBotGroupAdvanced({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toEqual(0);

    const evaluationResult = await evaluator.evaluate(user, history);
    console.log(evaluator.getReasons());
    expect(evaluationResult).toBe(true);
});
