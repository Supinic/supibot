import { eatCookie, fetchRandomCookieText, getValidUserCookieData } from "../cookie-logic.js";
import { isResultFailure } from "../../../classes/command.js";
import type { CookieSubcommandDefinition } from "../index.js";

export default {
	name: "eat",
	title: "Eat a cookie!",
	default: true,
	aliases: [],
	getDescription: (prefix) => [
		`<code>${prefix}cookie</code>`,
		`<code>${prefix}cookie eat</code>`,
		"Opens up, eats and reads a daily fortune cookie."
	],
	execute: async (context) => {
		const platform = sb.Platform.getAsserted("twitch");
		const cookieData = await getValidUserCookieData(context.user);
		const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(context.user);

		const result = eatCookie(cookieData, { hasDoubleCookieAccess });
		if (isResultFailure(result)) {
			return result;
		}

		await context.user.setDataProperty("cookie", cookieData);

		const cookieText = fetchRandomCookieText();
		const string = `Your ${result.type} cookie:`;
		return {
			success: true,
			reply: `${string} ${cookieText}`
		};
	}
} satisfies CookieSubcommandDefinition;
