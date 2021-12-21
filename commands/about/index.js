module.exports = {
	Name: "about",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts a summary of what supibot does, and what it is.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function about (context) {
		let presentSince = "";
		if (context.channel) {
			const date = await sb.Query.getRecordset(rs => rs
				.select("Posted")
				.from("chat_line", context.channel.getDatabaseName())
				.orderBy("ID ASC")
				.limit(1)
				.flat("Posted")
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
				Powered by Node.js ${hackEmote} running since February 2018.
				${presentSince}
			`
		};
	}),
	Dynamic_Description: null
};
