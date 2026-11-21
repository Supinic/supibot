import type { BotSubcommandDefinition } from "../index.ts";
import { twitchStreamSchema } from "../../../utils/schemas.ts";

export default {
	name: "check-live",
	title: "Re-check channel being live",
	aliases: [],
	getDescription: (prefix) => [
		`<code>${prefix}bot check-live</code>`,
		`<code>${prefix}bot check-live channel:(channel)</code>`,
		"Forcefully checks if a given channel is still live on Twitch.",
		"This is useful if Supibot still thinks a channel is online/offline when the opposite is actually true."
	],
	execute: async (context) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelName = params.channel ?? context.channel!.Name;

		const platform = sb.Platform.getAsserted("twitch");
		const channelId = await platform.getUserID(channelName);
		if (!channelId) {
			return {
				success: false,
				reply: "That channel doesn't exist on Twitch, or is banned, or otherwise unavailable!"
			};
		}

		const response = await core.Got.get("Helix")({
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
		const streams = twitchStreamSchema.parse(response.body).data;

		const isLiveHelix = (streams.length > 0);
		const isLiveLocal = list.includes(channelId);

		if (isLiveHelix === isLiveLocal) {
			const state = (isLiveHelix) ? "online" : "offline";
			return {
				success: true,
				reply: `All good! I correctly list the stream as ${state}, just like Twitch.`
			};
		}

		if (isLiveHelix) {
			await platform.addLiveChannelIdList(channelId);
			return {
				success: true,
				reply: `I set the channel to be listed as online.`
			};
		}
		else {
			await platform.removeLiveChannelIdList(channelId);
			return {
				success: true,
				reply: `I set the channel to be listed as offline.`
			};
		}
	}
} satisfies BotSubcommandDefinition;
