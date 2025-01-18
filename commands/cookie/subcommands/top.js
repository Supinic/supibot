module.exports = {
	name: "top",
	aliases: ["leaders", "leaderboard"],
	description: [
		`<code>$cookie top</code>`,
		`<code>$cookie leaders</code>`,
		`<code>$cookie leaderboard</code>`,
		`Posts the link to the <a href="/bot/cookie/list">cookie leaderboard</a> in the chat.`
	],
	execute: async () => ({
		reply: `Check out the cookie leaderboard here: https://supinic.com/bot/cookie/list`
	})
};
