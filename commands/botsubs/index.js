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
	Code: (async function botSubs () {
		const { availableEmotes } = sb.Platform.get("twitch").controller;
		const subEmoteSets = availableEmotes.filter(i => ["1", "2", "3"].includes(i.tier) && i.emotes.length > 0);
	
		const result = [];
		for (const setData of subEmoteSets) {
			const tierString = (setData.tier !== "1") ? ` (T${setData.tier})` : "";
			result.push({
				channel: `${setData.channel.login}${tierString}`,
				emote: sb.Utils.randArray(setData.emotes).token
			});
		}
	
		result.sort((a, b) => a.channel.localeCompare(b.channel));
		const channels = result.map(i => `#${i.channel}`);
		const emotes = result.map(i => i.emote);
		
		return {
			reply: "Supibot is currently subbed to: " + channels.join(", ") + " " + emotes.join(" ")
		};
	}),
	Dynamic_Description: null
};