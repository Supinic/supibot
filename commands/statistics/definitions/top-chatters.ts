import type { StatsSubcommandDefinition } from "../index.js";
import { unping } from "../../../utils/command-utils.js";
const BASE_LIMIT = 10;

export default {
	name: "top-chatters",
	aliases: ["topchatters"],
	title: "Top 10 chatters by chat lines",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats top-chatters</code>`,
		"Posts the top 10 users by chat lines sent in the context of the current channel.",
		"The usernames are \"unpinged\" by default, so don't worry you'll massping the entire chat!"
	],
	execute: async (context) => {
		const { channel } = context;
		if (!channel) {
			return {
				success: false,
				reply: `This command is not available here!`
			};
		}

		const top = await core.Query.getRecordset<{ messages: number; username: string; }[]>(rs => rs
			.select("SUM(Message_Count) AS messages")
			.select("User_Alias.Name AS username")
			.from("chat_data", "Message_Meta_User_Alias")
			.join("chat_data", "User_Alias")
			.where("Channel = %n", channel.ID)
			.groupBy("User_Alias")
			.orderBy("SUM(Message_Count) DESC")
			.limit(BASE_LIMIT)
		);

		const chatters = top.map(({ messages, username }, ind) => {
			const name = unping(username);
			const digits = core.Utils.groupDigits(messages);
			return `#${ind + 1}: ${name} (${digits})`;
		}).join(", ");

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Top ${BASE_LIMIT} chatters: ${chatters}`
		};
	}
} satisfies StatsSubcommandDefinition;
