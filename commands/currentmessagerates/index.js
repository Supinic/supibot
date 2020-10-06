module.exports = {
	Name: "currentmessagerates",
	Aliases: ["cmr"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current messages/minute stats in the current channel.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function currentMessageRates (context) {
		if (!context.channel) {
			return {
				success: false,
				reply: `Can't check for messages rates in private messages!`
			};
		}
	
		const rates = await sb.Query.getRecordset(rs => rs
			.select("Amount")
			.from("chat_data", "Message_Meta_Channel")
			.where("Channel = %n", context.channel.ID)
			.orderBy("Timestamp DESC")
			.limit(1)
			.single()
		);
	
		return {
			reply: `Message rates for the previous hour: ${rates?.Amount ?? 0} messages/hr.`
		};
	}),
	Dynamic_Description: null
};