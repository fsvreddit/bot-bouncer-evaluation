import { EvaluateDomainSharer } from "./userEvaluation/EvaluateDomainSharer.js";
import { EvaluateMixedBot } from "./userEvaluation/EvaluateMixedBot.js";
import { EvaluateFirstCommentEmDash } from "./userEvaluation/EvaluateFirstCommentEmDash.js";
import { EvaluateBadUsername } from "./userEvaluation/EvaluateBadUsername.js";
import { EvaluatePinnedPostTitles } from "./userEvaluation/EvaluatePinnedPostTitle.js";
import { EvaluateSelfComment } from "./userEvaluation/EvaluateSelfComment.js";
import { EvaluatePostTitle } from "./userEvaluation/EvaluatePostTitle.js";
import { EvaluateBioText } from "./userEvaluation/EvaluateBioText.js";
import { EvaluateObfuscatedBioKeywords } from "./userEvaluation/EvaluateObfuscatedBioKeywords.js";
import { EvaluateSocialLinks } from "./userEvaluation/EvaluateSocialLinks.js";
import { EvaluateSuspiciousFirstPost } from "./userEvaluation/EvaluateSuspiciousFirstPost.js";
import { EvaluateInconsistentAgeBot } from "./userEvaluation/EvaluateInconsistentAgeBot.js";
import { EvaluateInconsistentGenderBot } from "./userEvaluation/EvaluateInconsistentGenderBot.js";
import { EvaluateBadDisplayName } from "./userEvaluation/EvaluateBadDisplayname.js";
import { EvaluateWorldTraveller } from "./userEvaluation/EvaluateWorldTraveller.js";
import { EvaluateCommentPhrase } from "./userEvaluation/EvaluateCommentPhrase.js";
import { EvaluateRapidFireBot } from "./userEvaluation/EvaluateRapidFireBot.js";
import { EvaluateTGGroup } from "./userEvaluation/EvaluateTGGroup.js";
import { EvaluateFirstPostWithSelfComment } from "./userEvaluation/EvaluateFirstPostWithSelfComment.js";
import { EvaluateBotGroupAdvanced } from "./userEvaluation/EvaluateBotGroupAdvanced.js";
import { EvaluateBioTextDefinedHandles } from "./userEvaluation/EvaluateBioTextDefinedHandles.js";
import { EvaluatePostTitleDefinedHandles } from "./userEvaluation/EvaluatePostTitleDefinedHandles.js";
import { EvaluateBadDisplayNameDefinedHandles } from "./userEvaluation/EvaluateBadDisplaynameDefinedHandles.js";
import { EvaluatePostTitleMulti } from "./userEvaluation/EvaluatePostTitleMulti.js";
import { EvaluateWarmupBot } from "./userEvaluation/EvaluateWarmupBot.js";

/**
 * Array of all evaluators.
 *
 * In some scenarios, evaluators are run exactly in order, and may return true
 * as soon as one evaluator detects a bot.
 *
 * As a result, order entries to prioritise faster evaluators that do not need to
 * reference social links or account history first.
 */
export const ALL_EVALUATORS = [
    // Evaluators that can work based on the UserExtended object only
    EvaluateBadUsername,
    EvaluateBioText,
    EvaluateBioTextDefinedHandles,
    EvaluateBadDisplayName,
    EvaluateBadDisplayNameDefinedHandles,
    EvaluateObfuscatedBioKeywords,

    // Evaluators that reference posts and comments, but not social links
    EvaluateMixedBot,
    EvaluateDomainSharer,
    EvaluateFirstCommentEmDash,
    EvaluatePinnedPostTitles,
    EvaluateSelfComment,
    EvaluatePostTitle,
    EvaluatePostTitleDefinedHandles,
    EvaluatePostTitleMulti,
    EvaluateSuspiciousFirstPost,
    EvaluateInconsistentAgeBot,
    EvaluateInconsistentGenderBot,
    EvaluateWorldTraveller,
    EvaluateCommentPhrase,
    EvaluateRapidFireBot,
    EvaluateTGGroup,
    EvaluateFirstPostWithSelfComment,

    // Evaluators that need social links or other complicated data should be at the end
    EvaluateWarmupBot,
    EvaluateSocialLinks,
    EvaluateBotGroupAdvanced,
];
