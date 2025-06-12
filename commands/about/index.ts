import { SupiDate, SupiError } from "supi-core";
import { CommandDefinition } from "../../classes/command.js";

export default {
	Name: "about",
	Aliases: null,
	Cooldown: 30_000,
	Description: "Posts a summary of what Supibot does, and what it is. Also, mentions how long it's been in a channel, if applicable.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function about (context) {
		let presentSinceString = "";
		const { channel } = context;

		if (channel) {
			const botData = await sb.User.get(context.platform.Self_Name);
			if (!botData) {
				throw new SupiError({
				    message: "Assert error: Self-bot user data is not available"
				});
			}

			const date = await core.Query.getRecordset<SupiDate | undefined>(rs => rs
				.select("First_Message_Posted")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("Channel = %n", channel.ID)
				.where("User_Alias = %n", botData.ID)
				.limit(1)
				.flat("First_Message_Posted")
				.single()
			);

			if (date) {
				presentSinceString = `I am present in this channel since ${date.format("Y-m-d")} (${core.Utils.timeDelta(date)})`;
			}
		}

		const emote = await context.randomEmote("supiniL", "supiniOkay", "ppL", "🙂");
		const hackEmote = await context.randomEmote("supiniHack", "🤓");
		return {
			reply: core.Utils.tag.trim `
				I am a smol variety and utility bot ${emote}
				Running on a smol Raspberry Pi 3B ${emote}
				Powered by NodeJS ${hackEmote} running since February 2018.
				${presentSinceString}
			`
		};
	},
	Dynamic_Description: null
} satisfies CommandDefinition;
