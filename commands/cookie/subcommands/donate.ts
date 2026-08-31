import { canEatDailyCookie, canEatReceivedCookie, donateCookie, getValidUserCookieData } from "../cookie-logic.js";
import { isResultFailure } from "../../../classes/command.js";
import type { CookieSubcommandDefinition } from "../index.js";

export default {
	name: "donate",
	title: "Donate cookie to someone else",
	default: false,
	aliases: ["gift", "give"],
	getDescription: (prefix) => [
		`<code>${prefix}cookie donate (user)</code>`,
		`<code>${prefix}cookie gift (user)</code>`,
		`<code>${prefix}cookie give (user)</code>`,
		"Gives your daily cookie to another other user, if you so wish.",
		"Cookies received in this fashion cannot be passed to someone else."
	],
	execute: async (context, type, receiver) => {
		if (!receiver) {
			return {
				success: false,
				reply: `No user provided! Who do you want to ${type} the cookie to?`
			};
		}

		const cookieData = await getValidUserCookieData(context.user);
		const receiverUserData = await sb.User.get(receiver);
		if (!receiverUserData) {
			return {
				success: false,
				reply: `I haven't seen that user before, so you can't donate cookies to them!`
			};
		}
		else if (receiverUserData.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: "I appreciate the gesture, but thanks, I don't eat sweets :)"
			};
		}
		else if (context.user === receiverUserData) {
			return {
				success: false,
				reply: (!canEatDailyCookie(cookieData) && !canEatReceivedCookie(cookieData))
					? "You already ate or donated your daily cookie today, so you can't donate it, not even to yourself!"
					: "Okay...! So you passed the cookie from one hand to the other... Now what?"
			};
		}

		const platform = sb.Platform.getAsserted("twitch");
		const receiverCookieData = await getValidUserCookieData(receiverUserData);
		const result = donateCookie(
			cookieData,
			receiverCookieData,
			{ hasDoubleCookieAccess: await platform.fetchUserAdminSubscription(context.user) },
			{ hasDoubleCookieAccess: await platform.fetchUserAdminSubscription(receiverUserData) }
		);

		if (isResultFailure(result)) {
			return result;
		}

		await Promise.all([
			context.user.setDataProperty("cookie", cookieData),
			receiverUserData.setDataProperty("cookie", receiverCookieData)
		]);

		const emote = await context.getBestAvailableEmote(["Okayga", "supiniOkay", "FeelsOkayMan"], "😊");
		return {
			success: true,
			reply: `Successfully given your cookie for today to ${receiverUserData.Name} ${emote}`
		};
	}
} satisfies CookieSubcommandDefinition;
