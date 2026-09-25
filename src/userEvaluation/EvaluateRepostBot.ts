import { Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { domainFromUrl } from "./evaluatorHelpers.js";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { addWeeks, subDays, subMonths } from "date-fns";
import OpenAI from "openai";
import z from "zod";
import { ResponseInputMessageContentList } from "openai/resources/responses/responses.js";
import { zodTextFormat } from "openai/helpers/zod.js";
import { MAIN_APP_NAME } from "../constants.js";
import { count } from "@wordpress/wordcount";

export class EvaluateRepostBot extends UserEvaluatorBase {
    override name = "Repost Bot";
    override shortname = "repost";
    override banContentThreshold = 1;
    override needsOpenAiKey = true;

    private minWordsInTitle: number | undefined;

    private isEligiblePost (post: Post): boolean {
        if (post.nsfw || post.crosspostParentId) {
            return false;
        }

        this.minWordsInTitle ??= this.getVariable<number>("minWordsInTitle", 2);

        if (count(post.title, "words") < this.minWordsInTitle) {
            return false;
        }

        return domainFromUrl(post.url) === "i.redd.it" || post.gallery.length > 0;
    }

    override preEvaluatePost (post: Post): boolean {
        return this.isEligiblePost(post);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const maxAgeInMonths = this.getVariable<number>("maxAgeInMonths", 1);
        return user.createdAt > subMonths(new Date(), maxAgeInMonths);
    }

    private getImageUrl (post: Post): string {
        if (post.gallery.length > 0) {
            return post.gallery[0].url;
        }

        return post.url;
    }

    private postIdToUrl (postId: string): string {
        return `https://redd.it/${postId.substring(3)}`;
    }

    private async getPostSimilarity (postA: Post, postB: Post): Promise<number | undefined> {
        const cacheKey = `bbe:RepostBot:similarity:${postA.id}:${postB.id}`;
        const redis = this.context.appSlug === MAIN_APP_NAME ? this.context.redis.global : this.context.redis;
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult) {
            console.log(`Repost Checks: Using cached similarity between ${this.postIdToUrl(postA.id)} and ${this.postIdToUrl(postB.id)}: ${cachedResult}`);
            return parseFloat(cachedResult);
        }

        const openAI = new OpenAI({ apiKey: this.openAiKey });

        const responseFormat = z.object({
            similarity: z.number().min(0).max(1),
        });

        const prompt = this.getVariable<string>("prompt", "You are provided with the URLs of two images. Your task is to determine how visually similar they are. Return the similarity from 0 to 1, where 0 is completely different and 1 is identical. Only return the similarity as a number in JSON format, do not include any other text.");

        const content: ResponseInputMessageContentList = [
            {
                type: "input_text",
                text: prompt,
            },
            {
                type: "input_image",
                // eslint-disable-next-line camelcase
                image_url: this.getImageUrl(postA),
                detail: "low",
            },
            {
                type: "input_image",
                // eslint-disable-next-line camelcase
                image_url: this.getImageUrl(postB),
                detail: "low",
            },
        ];

        try {
            const response = await openAI.responses.create({
                model: this.getVariable<string>("openAiModel", "gpt-5.4-nano"),
                input: [
                    {
                        role: "user",
                        content,
                    },
                ],
                text: {
                    format: zodTextFormat(responseFormat, "similarity"),
                },
            });

            const result = JSON.parse(response.output_text) as z.infer<typeof responseFormat>;
            await redis.set(cacheKey, result.similarity.toString(), { expiration: addWeeks(new Date(), 1) });

            console.log(`Repost Checks: Tokens used: ${response.usage?.total_tokens}, Similarity between ${this.postIdToUrl(postA.id)} and ${this.postIdToUrl(postB.id)}: ${result.similarity}`);

            return result.similarity;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error getting post similarity for ${postA.id}: ${message}`);
            return;
        }
    }

    override async evaluate (user: UserExtended): Promise<boolean> {
        if (!this.preEvaluateUser(user)) {
            return false;
        }

        const comments = this.getComments();

        const maxCommentCount = this.getVariable<number>("maxCommentCount", 5);
        if (comments.length > maxCommentCount) {
            return false;
        }

        const posts = this.getPosts();

        if (posts.some(post => !this.isEligiblePost(post))) {
            return false;
        }

        if (posts.length === 0) {
            return false;
        }

        const maxPostCount = this.getVariable<number>("maxPostCount", 5);
        if (posts.length > maxPostCount) {
            return false;
        }

        // Sort posts, latest first
        const sortedPosts = posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latestPost = sortedPosts[0];

        // Look for duplicate posts.
        const postDuplicates = await this.context.reddit.searchPosts({
            query: `title:"${latestPost.title}"`,
            subredditName: latestPost.subredditName,
            sort: "new",
            limit: 100,
        }).all().then(posts => posts.filter(post => this.isEligiblePost(post) && post.title === latestPost.title && post.authorName !== latestPost.authorName));

        if (postDuplicates.length === 0) {
            return false;
        }

        const maxDuplicatePostCount = this.getVariable<number>("maxDuplicatePostCount", 50);
        if (postDuplicates.length > maxDuplicatePostCount) {
            return false;
        }

        // Sort duplicates, oldest first
        postDuplicates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const oldestDuplicate = postDuplicates[0];

        if (oldestDuplicate.createdAt > latestPost.createdAt) {
            return false;
        }

        const minDuplicateAgeInDays = this.getVariable<number>("minDuplicateAgeInDays", 7);
        if (oldestDuplicate.createdAt > subDays(new Date(), minDuplicateAgeInDays)) {
            return false;
        }

        const similarityNeeded = this.getVariable<number>("similarityNeeded", 0.9);

        const postSimilarity = await this.getPostSimilarity(latestPost, oldestDuplicate);
        if (postSimilarity === undefined) {
            return false;
        }

        if (postSimilarity < similarityNeeded) {
            return false;
        }

        this.addHitReason(`User's post ${this.postIdToUrl(latestPost.id)} is a repost of ${this.postIdToUrl(oldestDuplicate.id)} with similarity ${Math.round(postSimilarity * 100)}%`);

        return true;
    }
}
