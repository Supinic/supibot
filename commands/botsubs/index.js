/**
 * await sb.Got.get("Helix")({
 * 	url: "subscriptions/user",
 * 	searchParams: {
 * 		broadcaster_id: "31400525",
 * 		user_id: "31400525"
 * 	}
 * })
 */

module.exports = {
	Name: "botsubs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the channels Supibot is currently subscribed to on Twitch, along with a sample sub emote to each.",
	Flags: ["pipe"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "channelsOnly", type: "boolean" },
		{ name: "emotesOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function botSubs (context) {
		const twitch = sb.Platform.get("twitch");

		const globalEmotes = await twitch.fetchGlobalEmotes();
		const subEmotes = globalEmotes.filter(i => i.type === "twitch-subscriber" && i.channel);
		const subChannels = new Set(subEmotes.map(i => i.channel));

		const result = [];
		for (const channel of subChannels) {
			const channelEmotes = subEmotes.filter(i => i.channel === channel);
			result.push(sb.Utils.randArray(channelEmotes));
		}

		result.sort((a, b) => a.channel.localeCompare(b.channel));

		const channels = result.map(i => i.channel);
		const channelNames = channels.map(i => sb.Channel.getBySpecificId(i, twitch)?.Name ?? null).filter(Boolean);
		if (context.params.channelsOnly) {
			return {
				reply: channelNames.join(", ")
			};
		}

		const emotes = result.map(i => i.name).join(" ");
		if (context.params.emotesOnly) {
			return {
				reply: emotes
			};
		}

		let message = `I am currently subscribed to: ${channelNames.join(" ")} - ${emotes}`;
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
