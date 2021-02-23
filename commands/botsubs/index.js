module.exports = {
	Name: "botsubs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the channels supibot is currently subscribed to on Twitch, along with a sample sub emote to each.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function botSubs (context) {
		const { availableEmotes } = sb.Platform.get("twitch").controller;
		const subEmoteSets = availableEmotes
			.filter(i => ["1", "2", "3"].includes(i.tier) && i.emotes.length > 0)
			.sort((a, b) => Number(a.tier) - Number(b.tier));

		const result = [];
		const encountered = new Set();
		for (const setData of subEmoteSets) {
			const channel = setData.channel.login;
			if (encountered.has(channel)) {
				continue;
			}

			const tierString = (setData.tier !== "1") ? ` (T${setData.tier})` : "";
			result.push({
				channel: `${setData.channel.login}${tierString}`,
				emote: sb.Utils.randArray(setData.emotes).token
			});

			encountered.add(channel);
		}
	
		result.sort((a, b) => a.channel.localeCompare(b.channel));

		const channels = result.map(i => i.channel).join(", ");
		const emotes = result.map(i => i.emote).join(" ");
		let message = `Supibot is currently subbed to: ${channels} -- ${emotes}`;

		const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
		if (message.length > limit) {
			message = `Supibot is currently subscribed to ${result.length}: ${emotes}`;
		}

		return {
			reply: message
		};
	}),
	Dynamic_Description: null
};