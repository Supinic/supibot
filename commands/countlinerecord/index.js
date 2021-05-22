module.exports = {
	Name: "countlinerecord",
	Aliases: ["clr"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Posts the two records of each channel: The amount, and the total length of messages posted within each one minute.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function countLineRecord (context) {
		const [amountData, lengthData] = await Promise.all([
			sb.Query.getRecordset(rs => rs
				.select("Amount", "Timestamp")
				.from("chat_data", "Message_Meta_Channel")
				.where("Channel = %n", context.channel.ID)
				.orderBy("Amount DESC")
				.limit(1)
				.single()
			),
	
			sb.Query.getRecordset(rs => rs
				.select("Length", "Timestamp")
				.from("chat_data", "Message_Meta_Channel")
				.where("Channel = %n", context.channel.ID)
				.orderBy("Length DESC")
				.limit(1)
				.single()
			)
		]);
		
		if (!amountData || !lengthData) {
			return {
				success: false,
				reply: `This channel doesn't have enough data saved just yet!`
			};
		}
	
		return {
			reply: [
				"This channel's records are",
				`${amountData.Amount} messages/min`,
				`(${amountData.Timestamp.format("Y-m-d H:i")});`,
				"and",
				`${sb.Utils.round(lengthData.Length / 1000, 2)} kB/min`,
				`(${lengthData.Timestamp.format("Y-m-d H:i")})`
			].join(" ")
		};
	}),
	Dynamic_Description: null
};
