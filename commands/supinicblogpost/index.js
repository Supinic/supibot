module.exports = {
	Name: "supinicblogpost",
	Aliases: ["sbp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the timestamp and link of the latest blogpost Supinic keeps up on his Discord.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function supinicBlogPost () {
		return {
			reply: `Command deprecated - changelogs are now here: https://supinic.com/data/changelog/list`
		};
	}),
	Dynamic_Description: null
};
