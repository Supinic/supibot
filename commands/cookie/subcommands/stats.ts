import { getUserCookieCountStatistics } from "../../statistics/definitions/cookies.js";
import type { CookieSubcommandDefinition } from "../index.js";

export default {
	name: "stats",
	title: "Cookie statistics",
	aliases: ["statistics"],
	default: false,
	description: [
		`<code>$cookie stats</code>`,
		`<code>$cookie statistics</code>`,
		"Checks the total amount of cookies you have eaten, plus a quick \"karma check\" on how many you gifted vs. received.",
		"",

		`<code>$cookie statsc (user)</code>`,
		`<code>$cookie stats (user)</code>`,
		"Checks the cookies eaten for someone else, with the same karma check as above."
	],
	execute: async (context, type, user) => await getUserCookieCountStatistics(context, user)
} satisfies CookieSubcommandDefinition;
