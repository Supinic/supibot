import type { CheckSubcommandDefinition } from "../index.js";

export default {
	name: "subscription",
	aliases: ["subscriptions", "sub", "subs"],
	title: "Subscription events within Supibot",
	description: ["Fetches the list of your active event subscriptions within Supibot."],
	execute: async (context) => {
		const types = await core.Query.getRecordset<string[]>(rs => rs
			.select("Type")
			.from("data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Active = %b", true)
			.orderBy("Type")
			.flat("Type")
		);

		if (types.length === 0) {
			return {
				reply: "You're currently not subscribed to any Supibot event."
			};
		}
		else {
			return {
				reply: `You're currently subscribed to these events: ${types.join(", ")}`
			};
		}
	}
} satisfies CheckSubcommandDefinition;
