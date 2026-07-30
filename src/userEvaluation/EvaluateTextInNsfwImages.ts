import { EvaluatorRegex, ValidationIssue } from "./UserEvaluatorBase";
import { EvaluateBotGroupAdvanced } from "./EvaluateBotGroupAdvanced";
import { UserExtended } from "@fsvreddit/fsv-devvit-helpers";
import { addHours, compareDesc, subWeeks } from "date-fns";
import { domainFromUrl } from "./evaluatorHelpers";
import OpenAI from "openai";
import { ResponseInputMessageContentList } from "openai/resources/responses/responses.js";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod.js";
import { MAIN_APP_NAME } from "../constants";

export class EvaluateTextInNsfwImages extends EvaluateBotGroupAdvanced {
    override name = "Text in NSFW Images Bot";
    override shortname = "nsfwtext";

    override banContentThreshold = 0;

    override readonly needsOpenAiKey = true;

    override gatherRegexes (): EvaluatorRegex[] {
        const regexesFromSuper = super.gatherRegexes();

        const imageTextRegexes = this.getVariable<string[]>("imageTextRegexes", []);
        const requiredPostTitleRegexes = this.getVariable<string[]>("requiredPostTitleRegexes", []);

        const allRegexes = [...imageTextRegexes, ...requiredPostTitleRegexes];

        return [
            ...regexesFromSuper,
            ...allRegexes.map(regex => ({
                evaluatorName: this.name,
                regex,
                flags: "u",
            })),
        ];
    }

    override validateVariables (): ValidationIssue[] {
        const issues = super.validateVariables();

        const imageTextRegexes = this.getVariable<string[]>("imageTextRegexes", []);
        if (!Array.isArray(imageTextRegexes)) {
            issues.push({ severity: "error", message: "imageTextRegexes must be an array." });
        }

        for (const regex of imageTextRegexes) {
            try {
                new RegExp(regex, "u");
            } catch {
                issues.push({ severity: "error", message: `Invalid regex in imageTextRegexes: ${regex}` });
            }
        }

        const requiredPostTitleRegexes = this.getVariable<string[]>("requiredPostTitleRegexes", []);
        if (!Array.isArray(requiredPostTitleRegexes)) {
            issues.push({ severity: "error", message: "requiredPostTitleRegexes must be an array." });
        }

        for (const regex of requiredPostTitleRegexes) {
            try {
                new RegExp(regex, "u");
            } catch {
                issues.push({ severity: "error", message: `Invalid regex in requiredPostTitleRegexes: ${regex}` });
            }
        }

        return issues;
    }

    private async getTextFromImage (url: string): Promise<string | undefined> {
        if (!this.openAiKey) {
            return;
        }

        const resultCacheKey = `imageText:${url}`;
        const redis = this.context.subredditName === MAIN_APP_NAME ? this.context.redis.global : this.context.redis;
        const cachedResult = await redis.get(resultCacheKey);
        if (cachedResult) {
            console.log(`OpenAI Checks: Using cached result for image ${url}, Extracted Text: ${cachedResult}`);
            return JSON.parse(cachedResult) as string | undefined;
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
            return;
        }

        const result = JSON.parse(response.output_text) as z.infer<typeof responseFormat>;

        console.log(`OpenAI Checks: Tokens used: ${response.usage?.total_tokens}, Model: ${model}, Image URL: ${url}, Extracted Text: ${result.extractedText}`);

        await redis.set(resultCacheKey, JSON.stringify(result.extractedText), { expiration: addHours(new Date(), 1) });

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

        const recentNsfwPosts = posts.filter(post => post.nsfw && domainFromUrl(post.url) === "i.redd.it" && post.createdAt > subWeeks(new Date(), 1));
        if (recentNsfwPosts.length === 0) {
            return false;
        }

        recentNsfwPosts.sort((a, b) => compareDesc(a.createdAt, b.createdAt));

        const anyGroupMatches = await super.evaluate(user);
        if (!anyGroupMatches) {
            return false;
        }

        // Clear hit reasons from the super.evaluate call, as we want to only report hits from this specific evaluation
        this.hitReasons = undefined;

        const mostRecentNsfwPost = recentNsfwPosts[0];
        if (mostRecentNsfwPost.url.endsWith(".gif") || mostRecentNsfwPost.url.endsWith(".mp4")) {
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

        return false;
    }
}
