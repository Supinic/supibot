export default {
	Name: "about",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts a summary of what Supibot does, and what it is.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function about (context) {
		let presentSince = "";
		if (context.channel) {
			const botData = await sb.User.get(context.platform.Self_Name);

			/** @type {CustomDate|null} */
			const date = await sb.Query.getRecordset(rs => rs
				.select("First_Message_Posted")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("Channel = %n", context.channel.ID)
				.where("User_Alias = %n", botData.ID)
				.limit(1)
				.flat("First_Message_Posted")
				.single()
			);

			if (date) {
				presentSince = `I am present in this channel since ${date.format("Y-m-d")} (${sb.Utils.timeDelta(date)})`;
			}
		}

		const emote = await context.getBestAvailableEmote(["supiniL", "supiniOkay", "ppL"], "🙂");
		const hackEmote = await context.getBestAvailableEmote(["supiniHack"], "🤓");
		return {
			reply: sb.Utils.tag.trim `
				I am a smol variety and utility bot ${emote}
				Running on a smol Raspberry Pi 3B ${emote}
				Powered by NodeJS ${hackEmote} running since February 2018.
				${presentSince}
			`
		};
	}),
	Dynamic_Description: null
};
