import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { subDays, subMonths } from "date-fns";
import { EvaluateDomainSharer } from "../../src/userEvaluation/EvaluateDomainSharer.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";

const redditDomains = ["reddit.com", "redd.it", "i.redd.it", "v.redd.it"];

const baseVariables = {
    "generic:redditdomains": redditDomains,
    "domainsharer:ignoreddomains": ["example.com", "trusted.org"],
    "domainsharer:ignoredDomainSuffixes": [".gov", ".edu"],
    "domainsharer:autobandomains": ["spammy.biz"],
};

function createMockUser (overrides: Partial<UserExtended> = {}): UserExtended {
    return {
        id: "t2_fake",
        createdAt: subDays(new Date(), 30),
        username: "testuser",
        userDescription: "",
        commentKarma: 100,
        linkKarma: 50,
        hasVerifiedEmail: true,
        isGold: false,
        isModerator: false,
        isAdmin: false,
        nsfw: false,
        displayName: "testuser",
        ...overrides,
    };
}

function createPost (url: string, subredditName = "AskReddit", body?: string, daysAgo = 5): Post {
    return {
        id: `t3_${Math.random().toString(36).slice(2)}`,
        url,
        subredditName,
        body: body ?? "",
        createdAt: subDays(new Date(), daysAgo),
        title: "A post",
    } as unknown as Post;
}

function createComment (body: string, subredditName = "AskReddit", daysAgo = 5): Comment {
    return {
        id: `t1_${Math.random().toString(36).slice(2)}`,
        body,
        subredditName,
        createdAt: subDays(new Date(), daysAgo),
    } as unknown as Comment;
}

// ---------------------------------------------------------------------------
// preEvaluateUser
// ---------------------------------------------------------------------------

test("preEvaluateUser: passes for low-karma user", () => {
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    const user = createMockUser({ commentKarma: 100, linkKarma: 50 });
    expect(evaluator.preEvaluateUser(user)).toBe(true);
});

test("preEvaluateUser: fails for high comment-karma user", () => {
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    const user = createMockUser({ commentKarma: 5000, linkKarma: 50 });
    expect(evaluator.preEvaluateUser(user)).toBe(false);
});

test("preEvaluateUser: fails for high link-karma user", () => {
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    const user = createMockUser({ commentKarma: 50, linkKarma: 5000 });
    expect(evaluator.preEvaluateUser(user)).toBe(false);
});

// ---------------------------------------------------------------------------
// preEvaluatePost
// ---------------------------------------------------------------------------

test("preEvaluatePost: passes for post with an external URL", () => {
    const post = createPost("https://spammy.biz/article");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluatePost(post)).toBe(true);
});

test("preEvaluatePost: fails for internal reddit post (relative URL)", () => {
    const post = createPost("/r/AskReddit/comments/abc/something/");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluatePost(post)).toBe(false);
});

test("preEvaluatePost: fails for post whose domain is in ignoreddomains", () => {
    const post = createPost("https://example.com/page");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluatePost(post)).toBe(false);
});

test("preEvaluatePost: fails for post whose domain matches an ignoredDomainSuffix", () => {
    const post = createPost("https://health.gov/resource");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluatePost(post)).toBe(false);
});

test("preEvaluatePost: fails for post in an ignored subreddit", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredsubreddits": ["IgnoredSub"] };
    const post = createPost("https://spammy.biz/article", "IgnoredSub");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, variables);
    expect(evaluator.preEvaluatePost(post)).toBe(false);
});

test("preEvaluatePost: fails for post in a subreddit matching ignoredSubredditRegexes", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredSubredditRegexes": ["^Ignored.*$"] };
    const post = createPost("https://spammy.biz/article", "IgnoredSub");
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, variables);
    expect(evaluator.preEvaluatePost(post)).toBe(false);
});

// ---------------------------------------------------------------------------
// preEvaluateComment
// ---------------------------------------------------------------------------

test("preEvaluateComment: passes for comment with external domain", () => {
    const event: CommentCreate = {
        comment: { body: "Check this out: https://spammy.biz/page/" },
        subreddit: { name: "AskReddit" },
    } as unknown as CommentCreate;
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluateComment(event)).toBe(true);
});

test("preEvaluateComment: fails when no comment object", () => {
    const event: CommentCreate = {};
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluateComment: fails for comment in ignored subreddit", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredsubreddits": ["IgnoredSub"] };
    const event: CommentCreate = {
        comment: { body: "Check this out: https://spammy.biz/page/" },
        subreddit: { name: "IgnoredSub" },
    } as unknown as CommentCreate;
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, variables);
    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluateComment: fails for comment in a subreddit matching ignoredSubredditRegexes", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredSubredditRegexes": ["^Ignored.*$"] };
    const event: CommentCreate = {
        comment: { body: "Check this out: https://spammy.biz/page/" },
        subreddit: { name: "IgnoredSub" },
    } as unknown as CommentCreate;
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, variables);
    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluateComment: fails for comment containing only an ignored domain", () => {
    const event: CommentCreate = {
        comment: { body: "See https://example.com/page/ for details" },
        subreddit: { name: "AskReddit" },
    } as unknown as CommentCreate;
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

test("preEvaluateComment: fails for comment containing only a reddit domain", () => {
    const event: CommentCreate = {
        comment: { body: "See https://reddit.com/r/AskReddit/" },
        subreddit: { name: "AskReddit" },
    } as unknown as CommentCreate;
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, [], undefined, baseVariables);
    expect(evaluator.preEvaluateComment(event)).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — ignored domains
// ---------------------------------------------------------------------------

test("evaluate: returns false when all posts link to ignored domain", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://example.com/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: returns false when all comments link to ignored domain", () => {
    const history = Array.from({ length: 6 }, (_, i) => createComment("Check https://trusted.org/page/", "AskReddit", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — ignored domain suffixes
// ---------------------------------------------------------------------------

test("evaluate: returns false when all comments link to a .gov domain (ignoredDomainSuffixes)", () => {
    const history = Array.from({ length: 6 }, (_, i) => createComment("See https://health.gov/resource/", "AskReddit", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: returns false when all post bodies link to a .edu domain (ignoredDomainSuffixes)", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("/r/AskReddit/comments/abc/", "AskReddit", "See https://university.edu/article/", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: returns false when all posts link to a .gov domain URL (ignoredDomainSuffixes)", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://health.gov/resource", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: returns true when all posts link to a non-ignored domain with matching suffix", () => {
    // .biz is NOT in the ignored suffixes — should still trigger
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(true);
});

// ---------------------------------------------------------------------------
// evaluate — reddit domains filtered out
// ---------------------------------------------------------------------------

test("evaluate: returns false when all content links to reddit.com", () => {
    const history = Array.from({ length: 6 }, (_, i) => createComment("See https://reddit.com/r/all/", "AskReddit", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — minimum content threshold
// ---------------------------------------------------------------------------

test("evaluate: returns false when fewer than 5 recent items", () => {
    const history = Array.from({ length: 4 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — dominant domain detection
// ---------------------------------------------------------------------------

test("evaluate: returns true when all recent content shares the same domain", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(true);
});

test("evaluate: returns false when no single domain appears in every piece of content", () => {
    const history = [
        createPost("https://spammy.biz/a", "AskReddit", "", 1),
        createPost("https://otherspam.net/b", "AskReddit", "", 2),
        createPost("https://spammy.biz/c", "AskReddit", "", 3),
        createPost("https://otherspam.net/d", "AskReddit", "", 4),
        createPost("https://spammy.biz/e", "AskReddit", "", 5),
        createPost("https://otherspam.net/f", "AskReddit", "", 6),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: mixes posts and comments sharing same domain triggers detection", () => {
    const history = [
        createPost("https://spammy.biz/post1", "AskReddit", "", 1),
        createPost("https://spammy.biz/post2", "AskReddit", "", 2),
        createComment("Look at https://spammy.biz/comment1/", "AskReddit", 3),
        createComment("Look at https://spammy.biz/comment2/", "AskReddit", 4),
        createComment("Look at https://spammy.biz/comment3/", "AskReddit", 5),
        createComment("Look at https://spammy.biz/comment4/", "AskReddit", 6),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(true);
});

// ---------------------------------------------------------------------------
// evaluate — autoban domain
// ---------------------------------------------------------------------------

test("evaluate: sets canAutoBan when dominant domain is in autobandomains list", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    evaluator.evaluate(createMockUser());
    expect(evaluator.canAutoBan).toBe(true);
});

test("evaluate: does not set canAutoBan for domain not in autobandomains list", () => {
    const history = Array.from({ length: 6 }, (_, i) => createPost("https://otherspam.net/article", "AskReddit", "", i + 1));
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    evaluator.evaluate(createMockUser());
    expect(evaluator.canAutoBan).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — ignored subreddits excluded from content count
// ---------------------------------------------------------------------------

test("evaluate: content in ignored subreddits is excluded from evaluation", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredsubreddits": ["IgnoredSub"] };
    // Only 4 posts in non-ignored subs — below threshold
    const history = [
        ...Array.from({ length: 4 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1)),
        ...Array.from({ length: 10 }, (_, i) => createPost("https://spammy.biz/article", "IgnoredSub", "", i + 5)),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, variables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: content in regex-ignored subreddits is excluded from evaluation", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredSubredditRegexes": ["^Ignored.*$"] };
    // Only 4 posts in non-ignored subs — below threshold after regex-matched posts are filtered out
    const history = [
        ...Array.from({ length: 4 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1)),
        ...Array.from({ length: 10 }, (_, i) => createPost("https://spammy.biz/article", "IgnoredSub", "", i + 5)),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, variables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

test("evaluate: comments in regex-ignored subreddits are excluded from evaluation", () => {
    const variables = { ...baseVariables, "domainsharer:ignoredSubredditRegexes": ["^Ignored.*$"] };
    // Only 4 comments in non-ignored subs — below threshold after regex-matched comments are filtered out
    const history = [
        ...Array.from({ length: 4 }, (_, i) => createComment("Look at https://spammy.biz/comment/", "AskReddit", i + 1)),
        ...Array.from({ length: 10 }, (_, i) => createComment("Look at https://spammy.biz/comment/", "IgnoredSub", i + 5)),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, variables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});

// ---------------------------------------------------------------------------
// evaluate — old content excluded (beyond 6-month window)
// ---------------------------------------------------------------------------

test("evaluate: content older than 6 months is not counted", () => {
    const history = [
        // 4 recent posts
        ...Array.from({ length: 4 }, (_, i) => createPost("https://spammy.biz/article", "AskReddit", "", i + 1)),
        // 10 old posts beyond the 6-month window
        ...Array.from({ length: 10 }, (_, i) => ({
            id: `t3_old${i}`,
            url: "https://spammy.biz/article",
            subredditName: "AskReddit",
            body: "",
            createdAt: subMonths(new Date(), 7 + i),
            title: "Old post",
        } as unknown as Post)),
    ];
    const evaluator = new EvaluateDomainSharer({} as unknown as TriggerContext, history, undefined, baseVariables);
    const result = evaluator.evaluate(createMockUser());
    expect(result).toBe(false);
});
