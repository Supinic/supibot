const { tweets } = require("guy-beahm.json");

const MAXIMUM_REPEATS = 5;
const previousPosts = [];

module.exports = {
	Name: "forsenCD",
	Aliases: ["pajaCD"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "A random quote from the two time! 1993, 1994 back to back blockbuster video game champion, Guy \"DrDisrespect\" Beahm.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function forsenCD (context) {
		const eligibleTweets = tweets.filter(i => !previousPosts.includes(i));
		const post = sb.Utils.randArray(eligibleTweets);

		previousPosts.unshift(post);
		previousPosts.splice(MAXIMUM_REPEATS);

		return {
			reply: `${post} ${context.invocation}`
		};
	}),
	Dynamic_Description: null
};
