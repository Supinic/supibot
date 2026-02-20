import * as z from "zod";
import { declare } from "../../classes/command.js";
import rawSadCats from "./sad-cat.json" with { type: "json" };

const sadCats = z.array(z.string()).parse(rawSadCats);

const MAXIMUM_REPEATS = 5;
const previousPosts: string[] = [];

export default declare({
	Name: "randomsadcat",
	Aliases: ["rsc"],
	Cooldown: 10000,
	Description: "Posts a random sad cat image SadCat",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function randomSadCat (context) {
		const eligibleLinks = sadCats.filter(i => !previousPosts.includes(i));
		const link = core.Utils.randArray(eligibleLinks);

		previousPosts.unshift(link);
		previousPosts.splice(MAXIMUM_REPEATS);

		const emote = await context.getBestAvailableEmote(["SadCat", "sadCat", "mericCat"], "😿");
		return {
			success: true,
			reply: `${emote} ${link}`
		};
	},
	Dynamic_Description: null
});
