import * as z from "zod";
import { declare } from "../../classes/command.js";
import rawBeahmData from "./guy-beahm.json" with { type: "json" };

let beahmData: string[] | undefined;
const MAXIMUM_REPEATS = 5;
const previousPosts: string[] = [];
const jsonSchema = z.object({ tweets: z.array(z.string()) });

export default declare({
	Name: "forsenCD",
	Aliases: ["pajaCD"],
	Cooldown: 5000,
	Description: "A random quote from the two time! 1993, 1994 back to back blockbuster video game champion, Guy \"DrDisrespect\" Beahm.",
	Flags: ["pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function forsenCD (context) {
		beahmData ??= jsonSchema.parse(rawBeahmData).tweets;

		const eligibleTweets = beahmData.filter(i => !previousPosts.includes(i));
		const post = core.Utils.randArray(eligibleTweets);

		previousPosts.unshift(post);
		previousPosts.splice(MAXIMUM_REPEATS);

		return {
			success: true,
			reply: `${post} ${context.invocation}`
		};
	},
	Dynamic_Description: null
});
