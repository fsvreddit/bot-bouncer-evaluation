import { CommentCreate } from "@devvit/protos";
import { UserEvaluatorBase } from "./UserEvaluatorBase.js";
import { Comment, Post } from "@devvit/public-api";
import { UserExtended } from "../types.js";
import { compact, uniq } from "lodash";
import { subWeeks } from "date-fns";

export class EvaluateInconsistentAgeBot extends UserEvaluatorBase {
    override name = "Inconsistent Age Bot";
    override shortname = "inconsistentage";
    override banContentThreshold = 6;
    override canAutoBan = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override preEvaluateComment (_event: CommentCreate): boolean {
        return false;
    }

    private ageRegexes = [
        /^F\s?(18|19|[2-4][0-9])(?![$+])/,
        /^(18|19|[2-4][0-9])\s?F/,
        /^(18|19|[2-4][0-9]) \[F/,
    ];

    private getAgeFromPostTitle (title: string): number | undefined {
        for (const regex of this.ageRegexes) {
            const match = title.match(regex);
            if (match) {
                return parseInt(match[1]);
            }
        }
    }

    override preEvaluatePost (post: Post): boolean {
        if (!post.isNsfw()) {
            return false;
        }

        return this.getAgeFromPostTitle(post.title) !== undefined;
    }

    override preEvaluateUser (user: UserExtended): boolean {
        return user.commentKarma < 50;
    }

    override evaluate (user: UserExtended, history: (Post | Comment)[]): boolean {
        const nsfwPosts = this.getPosts(history, { since: subWeeks(new Date(), 2) })
            .filter(post => post.isNsfw() && !post.subredditName.toLowerCase().includes("roleplay"));

        const contentThreshold = this.getVariable<number>("contentthreshold", 6);
        this.banContentThreshold = contentThreshold;

        if (nsfwPosts.length < 4) {
            this.setReason("User has not posted enough NSFW posts in the last 2 weeks");
            return false;
        }

        const agesFound = uniq(compact(nsfwPosts.map(post => this.getAgeFromPostTitle(post.title))));

        if (agesFound.length < 3) {
            this.setReason(`User has not posted enough different ages in NSFW posts: ${agesFound.join(", ")}`);
            return false;
        }

        if (user.userDescription?.includes("shared") || user.userDescription?.includes("couple") || nsfwPosts.some(post => post.title.toLowerCase().includes("couple"))) {
            this.canAutoBan = false;
        }

        this.hitReason = `Inconsistent Age Bot: Found ${agesFound.length} different ages in ${nsfwPosts.length} posts`;
        return true;
    }
}
