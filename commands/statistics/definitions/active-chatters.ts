import type { StatsSubcommandDefinition } from "../index.js";

export default {
	name: "active-chatters",
	title: "Active chatters",
	aliases: ["ac"],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats active-chatters</code>`,
		`<code>${prefix}stats ac</code>`,
		`Checks how many chatters are active in chat across all channels Supibot is in, in the past 5 minutes.`
	],
	execute: async () => {
		const amount = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("Amount")
			.from("data", "Active_Chatter_Log")
			.orderBy("Timestamp DESC")
			.limit(1)
			.single()
			.flat("Amount")
		);

		if (typeof amount !== "number") {
			return {
				success: false,
				reply: "No data available! Try again later."
			};
		}

		return {
			success: true,
			reply: `Across all channels that I'm in, ${amount} chatters have been active in the past 5 minutes.`
		};
	}
} satisfies StatsSubcommandDefinition;
