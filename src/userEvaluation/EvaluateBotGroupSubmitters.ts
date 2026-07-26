import { SUBMITTER_BOT_NAME } from "../constants";
import { EvaluateBotGroupAdvanced } from "./EvaluateBotGroupAdvanced";
import { ValidationIssue } from "./UserEvaluatorBase";

export class EvaluateBotGroupAdvancedSubmitters extends EvaluateBotGroupAdvanced {
    override name = "Bot Group Advanced (Submitters)";
    override shortname = SUBMITTER_BOT_NAME;

    override allowNewFeatures = true;

    override validateVariables (): ValidationIssue[] {
        const issues = super.validateVariables();

        for (const group of this.getBotGroups()) {
            if (group.submitterName === undefined) {
                issues.push({ severity: "error", message: "submitterName is required for all bot groups in this evaluator." });
            }
        }
        return issues;
    }
}
