import type { CheckSubcommandDefinition } from "../index.js";

export default {
	name: "location",
	title: "User location",
	aliases: [],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}check location</code>`,
		`Checks your location, as set up within Supibot. Respects private locations.`,
		"",

		`<code>${prefix}check location (username)</code>`,
		`Checks someone else's location, as above.`
	],
	execute: async (context, identifier) => {
		const targetUser = (identifier)
			? await sb.User.get(identifier, true)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user does not exist!"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				reply: `My public location: Sitting on top of Supinic's LACK table`
			};
		}

		const locationData = await targetUser.getDataProperty("location");
		if (!locationData) {
			const pronoun = (context.user.ID === targetUser.ID) ? "You" : "They";
			return {
				reply: `${pronoun} have not set up a location.`
			};
		}

		const { formatted, hidden = false } = locationData;
		if (hidden) {
			if (context.user === targetUser) {
				await context.sendIntermediateMessage("As your location is set as private, I sent you a PM with it.");
				return {
					reply: `Your private location: ${formatted}`,
					replyWithPrivateMessage: true
				};
			}
			else {
				return {
					success: false,
					reply: `That user's location is private!`
				};
			}
		}
		else {
			const pronoun = (context.user.ID === targetUser.ID) ? "Your" : "That user's";
			return {
				reply: `${pronoun} public location: ${formatted}`
			};
		}
	}
} satisfies CheckSubcommandDefinition;
