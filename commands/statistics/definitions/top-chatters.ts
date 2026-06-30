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
		`Posts the top ${BASE_LIMIT} users by chat lines sent in the context of the current channel.`,
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

		const top = await core.Query.getRecordset<{ amount: number; userId: number; }[]>(rs => rs
			.select("Message_Count AS amount", "User_Alias AS userId")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("Channel = %n", channel.ID)
			.orderBy("Message_Count DESC")
			.limit(BASE_LIMIT)
		);

		const users = await sb.User.getMultiple(top.map(i => i.userId));
		const usernames = Object.fromEntries(users.map(i => ([i.ID, i.Name])));

		const chatters = top.map(({ amount, userId }, index) => {
			const username = unping(usernames[userId]);
			const digits = core.Utils.groupDigits(amount);
			return `#${index + 1}: ${username} (${digits})`;
		});

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Top ${BASE_LIMIT} chatters: ${chatters.join(", ")}`
		};
	}
} satisfies StatsSubcommandDefinition;
