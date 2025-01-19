const sadCats = require("./sad-cat.json");

const MAXIMUM_REPEATS = 5;
const previousPosts = [];

export default {
	Name: "randomsadcat",
	Aliases: ["rsc"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts a random sad cat image SadCat",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomSadCat (context) {
		const eligibleLinks = sadCats.filter(i => !previousPosts.includes(i));
		const link = sb.Utils.randArray(eligibleLinks);

		previousPosts.unshift(link);
		previousPosts.splice(MAXIMUM_REPEATS);

		const emote = await context.getBestAvailableEmote(["SadCat", "sadCat", "mericCat"], "😿");
		return {
			reply: `${emote} ${link}`
		};
	}),
	Dynamic_Description: null
};
