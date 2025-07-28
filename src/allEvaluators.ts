import { EvaluateDomainSharer } from "./userEvaluation/EvaluateDomainSharer.js";
import { EvaluateMixedBot } from "./userEvaluation/EvaluateMixedBot.js";
import { EvaluateFirstCommentEmDash } from "./userEvaluation/EvaluateFirstCommentEmDash.js";
import { EvaluateBadUsername } from "./userEvaluation/EvaluateBadUsername.js";
import { EvaluatePinnedPostTitles } from "./userEvaluation/EvaluatePinnedPostTitle.js";
import { EvaluateSelfComment } from "./userEvaluation/EvaluateSelfComment.js";
import { EvaluateSoccerStreamBot } from "./userEvaluation/EvaluateSoccerStreamBot.js";
import { EvaluateRepeatedPhraseBot } from "./userEvaluation/EvaluateRepeatedPhraseBot.js";
import { EvaluatePostTitle } from "./userEvaluation/EvaluatePostTitle.js";
import { EvaluateZombieNSFW } from "./userEvaluation/EvaluateZombieNSFWPoster.js";
import { EvaluateBioText } from "./userEvaluation/EvaluateBioText.js";
import { EvaluateObfuscatedBioKeywords } from "./userEvaluation/EvaluateObfuscatedBioKeywords.js";
import { EvaluateSocialLinks } from "./userEvaluation/EvaluateSocialLinks.js";
import { EvaluateSuspiciousFirstPost } from "./userEvaluation/EvaluateSuspiciousFirstPost.js";
import { EvaluateEditedComment } from "./userEvaluation/EvaluateEditedComment.js";
import { EvaluateInconsistentAgeBot } from "./userEvaluation/EvaluateInconsistentAgeBot.js";
import { EvaluateShortTlcNew } from "./userEvaluation/EvaluateShortTlcNew.js";
import { EvaluateInconsistentGenderBot } from "./userEvaluation/EvaluateInconsistentGenderBot.js";
import { EvaluateOFLinksBot } from "./userEvaluation/EvaluateOFLinksBot.js";
import { EvaluateBadDisplayName } from "./userEvaluation/EvaluateBadDisplayname.js";
import { EvaluateAdviceBot } from "./userEvaluation/EvaluateAdviceBot.js";
import { EvaluateWorldTraveller } from "./userEvaluation/EvaluateWorldTraveller.js";
import { EvaluateBotGroup } from "./userEvaluation/EvaluateBotGroup.js";
import { EvaluateBadUsernameYoung } from "./userEvaluation/EvaluateBadUsernameYoung.js";
import { EvaluateCommentPhrase } from "./userEvaluation/EvaluateCommentPhrase.js";
import { EvaluateRapidFireBot } from "./userEvaluation/EvaluateRapidFireBot.js";
import { EvaluateSuspiciousFirstPostPhrase } from "./userEvaluation/EvaluateSuspiciousFirstPostPhrase.js";
import { EvaluateTGGroup } from "./userEvaluation/EvaluateTGGroup.js";
import { EvaluateCommentBotGroup } from "./userEvaluation/EvaluateCommentBotGroup.js";
import { EvaluateFirstPostWithSelfComment } from "./userEvaluation/EvaluateFirstPostWithSelfComment.js";
import { EvaluateProductBot } from "./userEvaluation/EvaluateProductBot.js";
import { EvaluateBotGroupAdvanced } from "./userEvaluation/EvaluateBotGroupAdvanced.js";

export const ALL_EVALUATORS = [
    EvaluateBadUsername,
    EvaluateBadUsernameYoung,
    EvaluateBioText,
    EvaluateMixedBot,
    EvaluateDomainSharer,
    EvaluateFirstCommentEmDash,
    EvaluatePinnedPostTitles,
    EvaluateSelfComment,
    EvaluateSoccerStreamBot,
    EvaluateRepeatedPhraseBot,
    EvaluatePostTitle,
    EvaluateZombieNSFW,
    EvaluateObfuscatedBioKeywords,
    EvaluateSocialLinks,
    EvaluateSuspiciousFirstPost,
    EvaluateEditedComment,
    EvaluateInconsistentAgeBot,
    EvaluateInconsistentGenderBot,
    EvaluateShortTlcNew,
    EvaluateOFLinksBot,
    EvaluateBadDisplayName,
    EvaluateAdviceBot,
    EvaluateWorldTraveller,
    EvaluateBotGroup,
    EvaluateCommentPhrase,
    EvaluateRapidFireBot,
    EvaluateSuspiciousFirstPostPhrase,
    EvaluateTGGroup,
    EvaluateCommentBotGroup,
    EvaluateFirstPostWithSelfComment,
    EvaluateProductBot,
    EvaluateBotGroupAdvanced,
];
