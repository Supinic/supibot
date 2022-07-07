module.exports = {
	Name: "botsubs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the channels supibot is currently subscribed to on Twitch, along with a sample sub emote to each.",
	Flags: ["pipe"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "channelsOnly", type: "boolean" },
		{ name: "emotesOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function botSubs (context) {
		const { availableEmotes } = sb.Platform.get("twitch").controller;
		const subEmoteSets = availableEmotes
			.filter(i => ["1", "2", "3"].includes(i.tier) && i.emotes.length > 0)
			.sort((a, b) => Number(b.tier) - Number(a.tier));

		if (context.params.channel) {
			const channel = context.params.channel.toLowerCase();
			const sets = subEmoteSets.filter(i => i.channel.login === channel);
			if (sets.length === 0) {
				return {
					success: false,
					reply: `Supibot is not subscribed to #${channel}!`
				};
			}

			const strings = sets
				.sort((a, b) => Number(a.tier) - Number(b.tier))
				.map(i => `T${i.tier}: ${i.emotes.map(j => j.token).sort().join(" ")}`);

			return {
				reply: strings.join(" ")
			};
		}

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
		if (context.params.channelsOnly) {
			return {
				reply: channels
			};
		}

		const emotes = result.map(i => i.emote).join(" ");
		if (context.params.emoteOnly || context.params.emotesOnly) {
			return {
				reply: emotes
			};
		}

		let message = `Supibot is currently subscribed to: ${channels} - ${emotes}`;
		const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;

		if (message.length > limit) {
			message = `${result.length} channels: ${emotes}`;
		}

		return {
			reply: message
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches a list of all channels Supibot is currently subscribed to, along with a sample of their emotes.",
		"If the list is too long, the channel names are omitted, and only the emotes are posted.",
		"",

		`<code>${prefix}botsubs</code>`,
		"Simple list of channels + emotes, or just emotes if there are too many subscriptions.",
		"",

		`<code>${prefix}botsubs channel:(channel)</code>`,
		"Posts all subscriber emotes of the provided channel - but only if Supibot is subscribed.",
		"",

		`<code>${prefix}botsubs channelsOnly:true</code>`,
		"Posts all channels Supibot is subscribed to, omitting the random emote samples.",
		"",

		`<code>${prefix}botsubs emotesOnly:true</code>`,
		"Only posts random emote samples, 1 per each channel, without any other text.",
		""
	])
};
