/* eslint-disable camelcase */
import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { subDays } from "date-fns";
import { EvaluateTitleCopyBot } from "../../src/userEvaluation/EvaluateTitleCopyBot";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";

function createMockUser (daysOld: number): UserExtended {
    return {
        id: "t2_user",
        username: "testuser",
        createdAt: subDays(new Date(), daysOld),
        commentKarma: 10,
        linkKarma: 10,
        hasVerifiedEmail: true,
        isGold: false,
        isModerator: false,
        isAdmin: false,
        nsfw: false,
        userDescription: "",
        displayName: "testuser",
    };
}

function createComment (id: string, postId: string, body: string): Comment {
    return {
        id: `t1_${id}`,
        postId,
        body,
        subredditName: "AskReddit",
        createdAt: new Date(),
    } as unknown as Comment;
}

function createPost (id: string, title: string): Post {
    return {
        id,
        title,
        subredditName: "AskReddit",
        createdAt: new Date(),
        nsfw: false,
        url: "https://example.com",
    } as unknown as Post;
}

function createEvaluator (
    history: (Post | Comment)[] = [],
    variables: Record<string, unknown> = {},
    postLookup: Record<string, Post> = {},
): EvaluateTitleCopyBot {
    const context = {
        reddit: {
            // eslint-disable-next-line @typescript-eslint/require-await
            getPostById: async (postId: string) => postLookup[postId],
        },
    } as unknown as TriggerContext;

    return new EvaluateTitleCopyBot(context, history, undefined, variables);
}

test("preEvaluateComment: true when comment body matches post title after trim", () => {
    const evaluator = createEvaluator();
    const event: CommentCreate = {
        comment: { body: "  Same title  " },
        post: { title: "Same title" },
    } as unknown as CommentCreate;

    expect(evaluator.preEvaluateComment(event)).toBe(true);
});

test("preEvaluateComment: false when comment body missing", () => {
    const evaluator = createEvaluator();
    const event: CommentCreate = {
        post: { title: "Title" },
    } as unknown as CommentCreate;

    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluateComment: false when post title missing", () => {
    const evaluator = createEvaluator();
    const event: CommentCreate = {
        comment: { body: "Title" },
    } as unknown as CommentCreate;

    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluatePost: always false", () => {
    const evaluator = createEvaluator();
    expect(evaluator.preEvaluatePost(createPost("t3_1", "Any title"))).toBe(false);
});

test("preEvaluateUser: true for account younger than default max age", () => {
    const evaluator = createEvaluator();
    expect(evaluator.preEvaluateUser(createMockUser(30))).toBe(true);
});

test("preEvaluateUser: false for account older than default max age", () => {
    const evaluator = createEvaluator();
    expect(evaluator.preEvaluateUser(createMockUser(181))).toBe(false);
});

test("preEvaluateUser: respects maxAccountAgeDays override", () => {
    const evaluator = createEvaluator([], {
        "titlecopy:maxAccountAgeDays": 10,
    });

    expect(evaluator.preEvaluateUser(createMockUser(11))).toBe(false);
    expect(evaluator.preEvaluateUser(createMockUser(5))).toBe(true);
});

test("evaluate: false when any comment contains a newline", async () => {
    const history = [
        createComment("1", "t3_1", "first line\nsecond line"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Title 4"),
        createComment("5", "t3_5", "Title 5"),
    ];
    const evaluator = createEvaluator(history);

    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(false);
});

test("evaluate: false when fewer than required comments", async () => {
    const history = [
        createComment("1", "t3_1", "Title 1"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Title 4"),
    ];
    const evaluator = createEvaluator(history);

    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(false);
});

test("evaluate: false when user has posts", async () => {
    const history = [
        createComment("1", "t3_1", "Title 1"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Title 4"),
        createComment("5", "t3_5", "Title 5"),
        createPost("t3_own", "User post"),
    ];
    const evaluator = createEvaluator(history);

    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(false);
});

test("evaluate: false when one recent comment does not match post title", async () => {
    const history = [
        createComment("1", "t3_1", "Title 1"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Wrong title"),
        createComment("5", "t3_5", "Title 5"),
    ];

    const postLookup = {
        t3_1: createPost("t3_1", "Title 1"),
        t3_2: createPost("t3_2", "Title 2"),
        t3_3: createPost("t3_3", "Title 3"),
        t3_4: createPost("t3_4", "Title 4"),
        t3_5: createPost("t3_5", "Title 5"),
    };

    const evaluator = createEvaluator(history, {}, postLookup);
    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(false);
});

test("evaluate: true when required recent comments all copy post titles and no posts exist", async () => {
    const history = [
        createComment("1", "t3_1", "Title 1"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Title 4"),
        createComment("5", "t3_5", "Title 5"),
    ];

    const postLookup = {
        t3_1: createPost("t3_1", "Title 1"),
        t3_2: createPost("t3_2", "Title 2"),
        t3_3: createPost("t3_3", "Title 3"),
        t3_4: createPost("t3_4", "Title 4"),
        t3_5: createPost("t3_5", "Title 5"),
    };

    const evaluator = createEvaluator(history, {}, postLookup);
    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(true);
    expect(evaluator.hitReasons).toHaveLength(1);
});

test("evaluate: checks only numCommentsToCheck most recent comments", async () => {
    const history = [
        createComment("1", "t3_1", "Title 1"),
        createComment("2", "t3_2", "Title 2"),
        createComment("3", "t3_3", "Title 3"),
        createComment("4", "t3_4", "Title 4"),
        createComment("5", "t3_5", "Title 5"),
        createComment("6", "t3_6", "Not checked"),
    ];

    const postLookup = {
        t3_1: createPost("t3_1", "Title 1"),
        t3_2: createPost("t3_2", "Title 2"),
        t3_3: createPost("t3_3", "Title 3"),
        t3_4: createPost("t3_4", "Title 4"),
        t3_5: createPost("t3_5", "Title 5"),
        t3_6: createPost("t3_6", "Different title"),
    };

    const evaluator = createEvaluator(history, {
        "titlecopy:numCommentsToCheck": 5,
    }, postLookup);

    await expect(evaluator.evaluate(createMockUser(5))).resolves.toBe(true);
});
