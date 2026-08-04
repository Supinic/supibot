import type { SpecialEventDefinition } from "../generic-event.js";
import { fetchYoutubeChannelId } from "../../../utils/command-utils.js";
import { SupiError } from "supi-core";

export type YoutubeChannelSubData = {
	channels?: {
		handle: string;
		id: string;
	}[];
};

export const YOUTUBE_VIDEO_SUBSCRIPTION_TITLE = "YouTube video";

export default {
	title: YOUTUBE_VIDEO_SUBSCRIPTION_TITLE,
	names: ["youtube-video"],
	notes: "Usage: <code>subscribe/unsubscribe youtube-video (channel handle)</code> When the given YouTube channel uploads a new video, Supibot will PM you with the news. Can support multiple.",
	channelSpecificMention: false,
	type: "special",
	handler: async function (context, subscription, ...args) {
		const { invocation } = context;
		if (!subscription.loaded) {
			if (invocation === "subscribe") {
				subscription.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Platform: context.platform.ID,
					Type: YOUTUBE_VIDEO_SUBSCRIPTION_TITLE,
					Data: "{}",
					Active: true
				});
			}
			else if (invocation === "unsubscribe") {
				return {
					success: false,
					reply: "You're not subscribed yet, and can't unsubscribe!"
				};
			}
		}

		const data = JSON.parse(subscription.values.Data ?? "{}") as YoutubeChannelSubData;
		data.channels = data.channels ?? [];

		const channelId = await fetchYoutubeChannelId(args[0]);
		if (!channelId) {
			return {
				success: false,
				reply: "Could not find a YouTube channel for your provided handle!"
			};
		}

		const handle = args.at(0);
		if (!handle) {
			if (invocation === "unsubscribe") {
				subscription.values.Active = false;
				subscription.values.Data = null;
				await subscription.save();

				return {
					success: true,
					reply: "Successfully unsubscribed from all YouTube channels posting videos."
				};
			}
			else {
				const channelList = data.channels.map(i => i.handle);
				return {
					success: true,
					reply: (data.channels.length === 0)
						? "You're not subscribed to any channels."
						: `You're subscribed to these ${data.channels.length} channels: ${channelList.join(", ")}`
				};
			}
		}

		let response;
		const channelIds = new Set(data.channels.map(i => i.id));

		if (invocation === "subscribe") {
			if (channelIds.has(channelId)) {
				response = "You did not subscribe to any new channels.";
			}
			else {
				data.channels.push({ handle, id: channelId });
				response = `Successfully subscribed to ${handle}. You will be PM'd when a new video is uploaded. You're now subscribed to ${channelIds.size + 1} YouTube channel(s).`;
			}
		}
		else {
			const index = data.channels.findIndex(i => i.id === channelId);
			if (channelIds.has(channelId)) {
				if (index === -1) {
					throw new SupiError({
						message: "Assert error: Could not find channel ID",
						args: { channelId, data }
					});
				}

				data.channels.splice(index, 1);
				response = `Successfully unsubscribed from ${handle}. You're now subscribed to ${channelIds.size - 1} YouTube channel(s).`;
			}
			else {
				response = "You did not unsubscribe from any channels.";
			}
		}

		subscription.values.Active = (data.channels.length !== 0);
		subscription.values.Data = JSON.stringify(data, null, 4);
		await subscription.save();

		return {
			success: true,
			reply: response
		};
	}
} satisfies SpecialEventDefinition;
