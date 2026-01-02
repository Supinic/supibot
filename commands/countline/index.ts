import { declare } from "../../classes/command.js";

export default declare({
	Name: "countline",
	Aliases: ["cl"],
	Cooldown: 10000,
	Description: "Fetches the number of chat lines a specified user (or you, if nothing is provided) has sent in the current channel.",
	Flags: ["mention", "opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function countLine (context, username) {
		const channelData = context.channel;
		if (!channelData) {
			return {
				success: false,
				reply: `This command is not available in private messages!`
			};
		}

		const userData = (username)
			? await sb.User.get(username, true)
			: context.user;

		if (!userData) {
			return {
				success: false,
				reply: "No such user exists in the database!"
			};
		}

		const lines = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("Message_Count AS Total")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.where("Channel = %n", channelData.ID)
			.single()
			.flat("Total")
		);

		const who = (userData.ID === context.user.ID) ? "You have" : "That user has";
		if (!lines) {
			return {
				success: true,
				reply: `${who} sent no chat lines in this channel!`
			};
		}

		return {
			success: true,
			reply: `${who} sent ${core.Utils.groupDigits(lines)} chat lines in this channel so far.`
		};
	}),
	Dynamic_Description: null
});
