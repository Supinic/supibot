import { declare } from "../../classes/command.js";

export default declare({
	Name: "countlinechannel",
	Aliases: ["clc"],
	Cooldown: 60000,
	Description: "Fetches the number of chat lines in the current channel.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function countLineChannel (context) {
		const { channel } = context;
		if (!channel) {
			return {
				success: false,
				reply: "This command is not available in private messages!"
			};
		}

		const amount = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("SUM(Message_Count) AS TotalCount")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("Channel = %n", channel.ID)
			.flat("TotalCount")
			.single()
		);

		// Works for both `undefined` (no meta rows) and `0` (no lines, but meta rows exist)
		if (!amount) {
			return {
				success: false,
				reply: `I have not processed any messages in this channel so far, but this should change very shortly.`
			};
		}

		return {
			reply: `I have processed ${core.Utils.groupDigits(amount)} messages in this channel so far.`
		};
	}),
	Dynamic_Description: null
});
