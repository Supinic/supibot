import CookieLogic from "../cookie-logic.js";

export default {
	name: "eat",
	aliases: [],
	description: [
		`<code>$cookie</code>`,
		`<code>$cookie eat</code>`,
		"Opens up, eats and reads a daily fortune cookie."
	],
	flags: {
		defaultOnEmptyInput: true
	},
	execute: async (context, cookieData) => {
		const platform = sb.Platform.get("twitch");
		const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(context.user);

		const result = CookieLogic.eatCookie(cookieData, { hasDoubleCookieAccess });
		if (!result.success) {
			return result;
		}

		const { transaction } = context;
		const [cookieText] = await Promise.all([
			CookieLogic.fetchRandomCookieText(),
			context.user.setDataProperty("cookie", cookieData, { transaction })
		]);

		const string = `Your ${result.type} cookie:`;
		return {
			reply: `${string} ${cookieText}`
		};
	}
};
