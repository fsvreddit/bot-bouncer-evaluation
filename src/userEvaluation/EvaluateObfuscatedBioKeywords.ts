import { Comment, Post } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { UserExtended } from "../types.js";

export class EvaluateObfuscatedBioKeywords extends UserEvaluatorBase {
    override name = "Obfuscated Bio Keywords Bot";
    override shortname = "obfuscatedbiowords";
    override banContentThreshold = 1;

    private getKeywords (): string[] {
        return this.getVariable<string[]>("keywords", []);
    }

    private getAllowedTerms (): string[] {
        return this.getVariable<string[]>("allowedterms", []);
    }

    private bioTextMatches (user: UserExtended): boolean {
        if (!user.userDescription) {
            return false;
        }

        const keywords = this.getKeywords();
        const allowedTerms = this.getAllowedTerms();
        for (const keyword of keywords) {
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            const keywordLetters = [...keyword.toLowerCase()];
            for (let i = 0; i < keywordLetters.length; i++) {
                keywordLetters[i] = keywordLetters[i].replace("i", "[ie1]");
                keywordLetters[i] = keywordLetters[i].replace("o", "[o0]");
                keywordLetters[i] = keywordLetters[i].replace("a", "[a4@]");
                keywordLetters[i] = keywordLetters[i].replace("e", "[ei3]");
                keywordLetters[i] = keywordLetters[i].replace("s", "[s5]");
                keywordLetters[i] = keywordLetters[i].replace("t", "[t7]");
                keywordLetters[i] = keywordLetters[i].replace("b", "[b6]");
                keywordLetters[i] = keywordLetters[i].replace("g", "[g9]");
                keywordLetters[i] = keywordLetters[i].replace("l", "[l1]");
                keywordLetters[i] = keywordLetters[i].replace("z", "[z2]");
            }

            const regexComponents = [
                keywordLetters[0] + ".?" + keywordLetters.slice(1).join(".{0,2}"),
                keywordLetters.join("."),
                keywordLetters.join(".{2}"),
            ];

            const regexText = "(?:" + regexComponents.join("|") + ")";

            const regex = new RegExp("\\b" + regexText + "\\b", "i");
            const matches = user.userDescription.match(regex);
            if (!matches || matches.length !== 1) {
                continue;
            }

            if (matches[0].toLowerCase() === keyword.toLowerCase()) {
                continue;
            }

            if (allowedTerms.includes(matches[0].toLowerCase())) {
                continue;
            }

            this.hitReason = `Bio text matched obfuscated keyword: ${keyword} (matched "${matches[0]}")`;

            return true;
        }

        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_: CommentCreate): boolean {
        return this.getKeywords().length > 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluatePost (_: Post): boolean {
        return this.getKeywords().length > 0;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        if (user.commentKarma > 1000 || user.linkKarma > 5000) {
            return false;
        }

        return this.bioTextMatches(user);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override evaluate (_user: UserExtended, _history: (Post | Comment)[]): boolean {
        return true;
    }
}
