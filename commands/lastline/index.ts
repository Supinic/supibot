import { declare } from "../../classes/command.js";
import type { SupiDate } from "supi-core";

export default declare({
	Name: "lastline",
	Aliases: ["ll", "lastmessage", "lm"],
	Cooldown: 5000,
	Description: "Posts the target user's last chat line in the context of the current channel, and the date they sent it.",
	Flags: ["external-input", "mention", "opt-out", "pipe"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function lastLine (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "No user provided! You must mention a username to check their last line in this channel."
			};
		}

		const { channel, platform } = context;
		if (!channel) {
			return {
				success: false,
				reply: "This command is not available in PMs!"
			};
		}

		const targetUser = await sb.User.get(user, true);
		if (!targetUser) {
			return {
				success: false,
				reply: "User not found in the database!"
			};
		}
		else if (targetUser.Name === platform.selfName) {
			return {
				success: false,
				reply: "I'm right here! Boo! 👻"
			};
		}

		const userID = targetUser.ID;
		if (userID === context.user.ID) {
			return {
				success: false,
				reply: "You're right here! 👻 I can see you"
			};
		}

		const data = await core.Query.getRecordset<{ message: string; posted: SupiDate; } | undefined>(rs => rs
			.select("Last_Message_Text AS message", "Last_Message_Posted AS posted")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userID)
			.where("Channel = %n", channel.ID)
			.single()
		);

		if (!data) {
			return {
				success: false,
				reply: "That user has not said anything in this channel!"
			};
		}

		if (context.params.textOnly) {
			return {
				success: true,
				reply: data.message
			};
		}

		const prefix = (targetUser.ID === context.user.ID) ? "Your" : "That user's";
		return {
			partialReplies: [
				{
					bancheck: false,
					message: `${prefix} last message in this channel was (${core.Utils.timeDelta(data.posted)}):`
				},
				{
					bancheck: true,
					message: data.message
				}
			]
		};
	}),
	Dynamic_Description: (prefix) => [
		"Checks the last message for a provided user, in the context of the current channel.",
		"",

		`<code>${prefix}lastline (user)</code>`,
		`<code>${prefix}ll (user)</code>`,
		"Posts that user's last message in this channel."
	]
});
