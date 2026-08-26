import type { CookieSubcommandDefinition } from "../index.js";

export default {
	name: "top",
	title: "Cookie consumers leaderboard",
	aliases: ["leaders", "leaderboard"],
	default: false,
	getDescription: (prefix) => [
		`<code>${prefix}cookie top</code>`,
		`<code>${prefix}cookie leaders</code>`,
		`<code>${prefix}cookie leaderboard</code>`,
		`Posts the link to the <a href="/bot/cookie/list">cookie leaderboard</a> in the chat.`
	],
	execute: () => ({
		success: true,
		reply: `Check out the cookie leaderboard here: https://supinic.com/bot/cookie/list`
	})
} satisfies CookieSubcommandDefinition;
