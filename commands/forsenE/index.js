module.exports = {
	Name: "forsenE",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random forsenE tweet.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function forsenE () {
		const { lines } = require("./forsenE.json");
		const post = sb.Utils.randArray(lines.filter(i => !this.data.previousPosts.includes(i)));

		this.data.previousPosts ??= [];
		this.data.previousPosts.unshift(post);
		this.data.previousPosts.splice(this.staticData.repeats);

		return {
			reply: `${post} forsenE`
		};
	}),
	Dynamic_Description: null
};
