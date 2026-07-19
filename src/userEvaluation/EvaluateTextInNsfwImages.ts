import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase } from "./UserEvaluatorBase";
import { Post } from "@devvit/public-api";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { compareDesc, differenceInSeconds, differenceInMonths, subWeeks } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers";
import OpenAI from "openai";
import { ResponseInputMessageContentList } from "openai/resources/responses/responses.js";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod.js";

export class EvaluateTextInNsfwImages extends UserEvaluatorBase {
    override name = "Text in NSFW Images Bot";
    override shortname = "nsfwtext";

    override banContentThreshold = 0;

    override readonly needsOpenAiKey = true;

    override gatherRegexes (): EvaluatorRegex[] {
        const imageTextRegexes = this.getVariable<string[]>("imageTextRegexes", []);
        const requiredPostTitleRegexes = this.getVariable<string[]>("requiredPostTitleRegexes", []);

        const allRegexes = [...imageTextRegexes, ...requiredPostTitleRegexes];

        return allRegexes.map(regex => ({
            evaluatorName: this.name,
            regex,
            flags: "u",
        }));
    }

    private isEligiblePost (post: Post): boolean {
        if (!post.nsfw) {
            return false;
        }
        const domain = domainFromUrl(post.url);
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        return post.body?.startsWith("https://preview.redd.it/") || (!post.body && domain === "i.redd.it");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return false;
    }

    override preEvaluatePost (post: Post): boolean {
        return this.isEligiblePost(post);
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const minAccountAgeInMonths = this.getVariable<number>("minAccountAgeInMonths", 0);
        return user.nsfw && differenceInMonths(new Date(), user.createdAt) >= minAccountAgeInMonths;
    }

    private async getTextFromImage (url: string): Promise<string | undefined> {
        if (!this.openAiKey) {
            return;
        }

        const openAIClient = new OpenAI({
            apiKey: this.openAiKey,
        });

        const responseFormat = z.object({
            extractedText: z.string().optional().nullable(),
        });

        const content: ResponseInputMessageContentList = [
            {
                type: "input_text",
                text: "You are given a list of image URLs. For each image, extract any text that appears in the image. If no text is present, return null.",
            },
            {
                type: "input_image",
                // eslint-disable-next-line camelcase
                image_url: url,
                detail: "low",
            },
        ];

        const model = this.getVariable<string>("openAiModel", "gpt-5.4-nano");

        let response: OpenAI.Responses.Response;
        try {
            response = await openAIClient.responses.create({
                model,
                input: [
                    {
                        role: "user",
                        content,
                    },
                ],
                text: {
                    format: zodTextFormat(responseFormat, "extracted_text"),
                },
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`OpenAI Checks: API request failed for image ${url} with error: ${errorMessage}`);
            throw new Error(`OpenAI API request failed with error: ${errorMessage}`);
        }

        const result = JSON.parse(response.output_text) as z.infer<typeof responseFormat>;

        const verboseLogs = this.getVariable<boolean>("verboseLogs", false);
        if (verboseLogs) {
            console.log(`OpenAI Checks: Tokens used: ${response.usage?.total_tokens}, Model: ${model}, Image URL: ${url}, Extracted Text: ${result.extractedText}`);
        }

        if (!result.extractedText) {
            return;
        }

        return result.extractedText;
    }

    override async evaluate (user: UserExtended): Promise<boolean> {
        if (!this.openAiKey) {
            return false;
        }

        const imageTextRegexes = this.getVariable<string[]>("imageTextRegexes", []).map(regex => new RegExp(regex, "iu"));

        if (imageTextRegexes.length === 0) {
            return false;
        }

        const posts = this.getPosts();

        if (posts.some(post => !this.isEligiblePost(post) && post.createdAt > subWeeks(new Date(), 1))) {
            return false;
        }

        const recentPostsWithBody = posts.filter(post => this.isEligiblePost(post) && post.body && post.createdAt > subWeeks(new Date(), 1));
        if (recentPostsWithBody.length > 0) {
            return false;
        }

        const comments = this.getComments();
        if (comments.some(comment => comment.createdAt > subWeeks(new Date(), 1))) {
            return false;
        }

        const recentNsfwPosts = posts.filter(post => post.nsfw && domainFromUrl(post.url) === "i.redd.it" && post.createdAt > subWeeks(new Date(), 1));

        const requiredPostCount = this.getVariable<number>("requiredPostCount", 3);

        if (recentNsfwPosts.length < requiredPostCount) {
            return false;
        }

        const requiredPostTitleRegexes = this.getVariable<string[]>("requiredPostTitleRegexes", []);
        if (requiredPostTitleRegexes.length > 0) {
            const requiredPostTitleRegexObjects = requiredPostTitleRegexes.map(regex => new RegExp(regex, "u"));
            if (!recentNsfwPosts.some(post => requiredPostTitleRegexObjects.some(regex => regex.test(post.title)))) {
                return false;
            }
        }

        recentNsfwPosts.sort((a, b) => compareDesc(a.createdAt, b.createdAt));

        const requiredIntervalBetweenNsfwPosts = this.getVariable<number>("requiredIntervalBetweenNsfwPosts", 5 * 60); // 5 minutes

        let previousPost: Post | undefined;
        let postWithinIntervalFound = false;
        for (const post of recentNsfwPosts.sort((a, b) => compareDesc(a.createdAt, b.createdAt))) {
            if (!previousPost) {
                previousPost = post;
                continue;
            }

            if (differenceInSeconds(previousPost.createdAt, post.createdAt) < requiredIntervalBetweenNsfwPosts) {
                postWithinIntervalFound = true;
                break;
            }
        }

        if (!postWithinIntervalFound) {
            return false;
        }

        const socialLinks = await this.getSocialLinks(user.username);
        if (socialLinks.length > 0) {
            return false;
        }

        const mostRecentNsfwPost = recentNsfwPosts[0];
        const domain = domainFromUrl(mostRecentNsfwPost.url);
        if (domain !== "i.redd.it") {
            return false;
        }

        const extractedText = await this.getTextFromImage(mostRecentNsfwPost.url);

        if (!extractedText) {
            return false;
        }

        for (const regex of imageTextRegexes) {
            if (regex.test(extractedText)) {
                this.addHitReason(`Matched regex "${regex.source}" in extracted text from image: "${extractedText}"`);
                return true;
            }
        }

        return true;
    }
}
