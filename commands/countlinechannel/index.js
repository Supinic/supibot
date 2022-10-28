module.exports = {
	Name: "countlinechannel",
	Aliases: ["clc"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Fetches the number of chat lines in the current channel.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function countLineChannel (context) {
		if (!context.channel) {
			return {
				reply: "This command is not available in private messages!"
			};
		}

		const amount = await sb.Query.getRecordset(rs => rs
			.select("SUM(Message_Count) AS TotalCount")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("Channel = %n", context.channel.ID)
			.flat("TotalCount")
			.single()
		);
		
		// Works for both `undefined` (no meta rows) and `0` (no lines, but meta rows exist)
		if (!amount) {
			return {
				reply: `I have not processed any messages in this channel so far. This should change rather soon though!`
			};
		}

		return {
			reply: `I have seen ${sb.Utils.groupDigits(amount)} messages in this channel so far.`
		};
	}),
	Dynamic_Description: null
};
