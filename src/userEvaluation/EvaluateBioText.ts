import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { EvaluatorRegex, UserEvaluatorBase, ValidationIssue } from "./UserEvaluatorBase.js";
import { UserExtended } from "../extendedDevvit.js";
import markdownEscape from "markdown-escape";
import { uniq } from "lodash";

export class EvaluateBioText extends UserEvaluatorBase {
    override name = "Bio Text Bot";
    override shortname = "biotext";
    override banContentThreshold = 0;

    private getBioText () {
        const bannableBioText = this.getVariable<string[]>("bantext", []);
        const reportableBioText = this.getVariable<string[]>("reporttext", []);
        return { bannableBioText, reportableBioText };
    }

    override preEvaluateComment (event: CommentCreate): boolean {
        const { bannableBioText, reportableBioText } = this.getBioText();
        const problematicBioText = [...bannableBioText, ...reportableBioText];

        return problematicBioText.some(bioText => event.author?.description && new RegExp(bioText, "u").test(event.author.description));
    }

    override validateVariables (): ValidationIssue[] {
        const results: ValidationIssue[] = [];
        const regexes = [
            ...this.getVariable<string[]>("bantext", []),
            ...this.getVariable<string[]>("reporttext", []),
        ];

        for (const regexVal of regexes) {
            let regex: RegExp;
            try {
                regex = new RegExp(regexVal);
            } catch {
                results.push({ severity: "error", message: `Invalid regex in biotext: ${regexVal}` });
                continue;
            }

            if (regex.test("")) {
                results.push({ severity: "error", message: `Bio Text regex is too greedy: ${regexVal}` });
            }
        }

        return results;
    }

    override gatherRegexes (): EvaluatorRegex[] {
        const { bannableBioText, reportableBioText } = this.getBioText();
        return uniq([
            ...bannableBioText.map(regex => ({
                evaluatorName: this.name,
                regex,
                flags: "u",
            })),
            ...reportableBioText.map(regex => ({
                evaluatorName: this.name,
                regex,
                flags: "u",
            })),
        ]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        const { bannableBioText, reportableBioText } = this.getBioText();

        return bannableBioText.length > 0 || reportableBioText.length > 0;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        const { bannableBioText, reportableBioText } = this.getBioText();

        if (bannableBioText.length === 0 && reportableBioText.length === 0) {
            return false;
        }

        if (user.commentKarma > 2000 && user.linkKarma > 2000) {
            return false;
        }

        const problematicBioText = [...bannableBioText, ...reportableBioText];
        return problematicBioText.some(bioText => user.userDescription && new RegExp(bioText, "u").test(user.userDescription));
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        const { bannableBioText, reportableBioText } = this.getBioText();

        if (bannableBioText.length === 0 && reportableBioText.length === 0) {
            return false;
        }

        const bannableBioTextFound = bannableBioText.find(bio => user.userDescription && new RegExp(bio, "u").test(user.userDescription));
        const reportableBioTextFound = reportableBioText.find(bio => user.userDescription && new RegExp(bio, "u").test(user.userDescription));

        if (bannableBioTextFound) {
            this.canAutoBan = true;
            this.addHitReason(`Bio text matched regex: ${markdownEscape(bannableBioTextFound)}`);
        } else if (reportableBioTextFound) {
            this.canAutoBan = false;
            this.addHitReason(`Bio text matched regex: ${markdownEscape(reportableBioTextFound)}`);
        } else {
            return false;
        }

        return user.nsfw || this.getPosts(history).some(post => post.isNsfw());
    }
}
