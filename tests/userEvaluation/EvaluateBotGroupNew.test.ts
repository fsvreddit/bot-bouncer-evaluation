import { subDays } from "date-fns";
import { UserExtended } from "../../src/types";
import { EvaluateBotGroupNew } from "../../src/userEvaluation/EvaluateBotGroupNew";
import { yamlToVariables } from "../../src/utility";
import { Comment, Post, TriggerContext } from "@devvit/public-api";

test("Simple account properties evaluation", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, []);
    expect(evaluationResult).toBe(true);
});

test("Simple criteria", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("And Criteria", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Or Criteria", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Not Criteria returns false", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Not Criteria returns true", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Min items criteria matches", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});

test("Min items criteria does not match", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Badly formed YAML", () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors.length).toBeGreaterThan(0);
});

test("Not subredditName criteria with comment in the sub", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(false);
});

test("Not subredditName criteria with comment outside the sub", async () => {
    const yaml = `
name: botgroupnew
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
    const evaluator = new EvaluateBotGroupNew({} as unknown as TriggerContext, variables);
    const errors = evaluator.validateVariables();
    expect(errors).toEqual([]);

    const evaluationResult = await evaluator.evaluate(user, history);
    expect(evaluationResult).toBe(true);
});
