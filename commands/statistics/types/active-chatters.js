export default {
	name: "active-chatters",
	aliases: ["activechatters"],
	description: "Checks how many chatters are active in chat in the past 5 minutes.",
	execute: async () => {
		const amount = await sb.Query.getRecordset(rs => rs
			.select("Amount")
			.from("data", "Active_Chatter_Log")
			.orderBy("Timestamp DESC")
			.limit(1)
			.single()
			.flat("Amount")
		);

		return {
			reply: `Across all channels that I'm in, ${amount} chatters have been active in the past 5 minutes.`
		};
	}
};
