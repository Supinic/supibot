module.exports = {
	Name: "randomsadcat",
	Aliases: ["rsc"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts a random sad cat image SadCat",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		repeats: 3
	})),
	Code: (async function randomSadCat (context) {
		this.data.previousPosts ??= [];

		const sadCats = require("./sad-cat.json");
		const post = sb.Utils.randArray(sadCats.filter(i => !this.data.previousPosts.includes(i)));

		this.data.previousPosts.unshift(post);
		this.data.previousPosts.splice(this.staticData.repeats);

		const emote = await context.getBestAvailableEmote(["SadCat", "sadCat", "mericCat"], "😿");
		return {
			reply: `${emote} ${post}`
		};
	}),
	Dynamic_Description: null
};
