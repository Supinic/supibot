module.exports = {
	Name: "forsenCD",
	Aliases: ["pajaCD"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "A random quote from the two time! 1993, 1994 back to back blockbuster video game champion!",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: ({
		repeats: 5
	}),
	Code: (async function forsenCD (context) {
		this.data.previousPosts ??= [];

		const { tweets } = require("./guy-beahm.json");
		const post = sb.Utils.randArray(tweets.filter(i => !this.data.previousPosts.includes(i)));

		this.data.previousPosts.unshift(post);
		this.data.previousPosts.splice(this.staticData.repeats);

		return {
			reply: `${post} ${context.invocation}`
		};
	}),
	Dynamic_Description: null
};
