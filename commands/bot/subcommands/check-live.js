const LIVE_STRING = {
	true: "online",
	false: "offline"
};

export default {
	name: "check-live",
	aliases: [],
	description: [
		`<code>$bot check-live/code>`,
		`<code>$bot check-live channel:(channel)</code>`,
		"Forcefully checks if a given channel is still live on Twitch.",
		"This is useful if Supibot still thinks a channel is online/offline when the opposite is actually true."
	],
	execute: async (context, options = {}) => {
		const { channelData } = options;

		/** @type {TwitchPlatform} */
		const platform = channelData.Platform;
		if (platform.name !== "twitch") {
			return {
				success: false,
				reply: "Cannot check for non-Twitch channels being live!"
			};
		}

		const channelId = channelData.Specific_ID;
		const response = await sb.Got.get("Helix")({
			url: "streams",
			searchParams: {
				user_id: channelId
			}
		});

		if (!response.ok) {
			return {
				success: false,
				reply: "Could not check Twitch for live status! Try again later."
			};
		}

		const list = await platform.getLiveChannelIdList();
		const isLiveHelix = (response.body.data.length > 0);
		const isLiveLocal = list.includes(channelId);

		if (isLiveHelix === isLiveLocal) {
			return {
				reply: `All good! I correctly list the stream as ${LIVE_STRING[isLiveHelix]}, just like Twitch.`
			};
		}

		if (isLiveHelix) {
			await platform.addLiveChannelIdList(channelId);
			return {
				reply: `I set the channel to be listed as online.`
			};
		}
		else {
			await platform.removeLiveChannelIdList(channelId);
			return {
				reply: `I set the channel to be listed as offline.`
			};
		}
	}
};
