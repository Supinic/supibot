import { parseRSS } from "../../utils/command-utils.js";
import { SupiDate, SupiError } from "supi-core";
import type { User } from "../../classes/user.js";
import type { CronDefinition } from "../index.js";
import type { Platform } from "../../platforms/template.js";
import {
	YOUTUBE_VIDEO_SUBSCRIPTION_TITLE,
	type YoutubeChannelSubData
} from "../../commands/subscribe/event-types/youtube-video.js";

type SubData = {
	userId: User["ID"];
	platform: Platform["ID"];
	rawData: string;
};
type ConfirmedYtChannelSubData = {
	channels: NonNullable<YoutubeChannelSubData["channels"]>;
};

export default {
	name: "youtube-rss-video-checker",
	expression: "0 */5 * * * *",
	description: "Works in tandem with the `youtube-video` subscription to check for new YouTube videos and announce them for subscribed users.",
	code: (async function fetchYoutubeRssVideos () {
		const subs = await core.Query.getRecordset<SubData[]>(rs => rs
			.select("User_Alias as userId", "Data as rawData", "Platform as platform")
			.from("data", "Event_Subscription")
			.where("Active = %b", true)
			.where("Type = %s", YOUTUBE_VIDEO_SUBSCRIPTION_TITLE)
			.where("Data IS NOT NULL")
		);

		if (subs.length === 0) {
			return;
		}

		const uniqueChannelIds = new Set<string>();
		const channelHandleMap = new Map<string, string>();
		const userChannelMap = new Map<User["ID"], Set<string>>();
		const userPlatformMap = new Map<User["ID"], Platform>();

		for (const sub of subs) {
			const channelIds = new Set<string>();
			const { channels } = JSON.parse(sub.rawData) as ConfirmedYtChannelSubData;
			for (const channel of channels) {
				channelIds.add(channel.id);
				uniqueChannelIds.add(channel.id);
				channelHandleMap.set(channel.id, channel.handle);
			}

			const platform = sb.Platform.getAsserted(sub.platform);
			userPlatformMap.set(sub.userId, platform);
			userChannelMap.set(sub.userId, channelIds);
		}

		const updatedChannels = new Set<string>();
		const channelVideosMap = new Map<string, string[]>();
		const ts = SupiDate.now() % 15;

		for (const channelId of uniqueChannelIds) {
			const response = await core.Got.get("GenericAPI")({
				url: `https://www.youtube.com/feeds/videos.xml`,
				searchParams: {
					channel_id: channelId,
					ts
				},
				responseType: "text",
				timeout: {
					request: 10_000
				},
				retry: {
					limit: 5,
					errorCodes: ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"]
				}
			});
			if (!response.ok) {
				continue;
			}

			const { items } = await parseRSS(response.body);
			if (items.length === 0) {
				continue;
			}

			const key = `youtube-latest-publish-date-${channelId}`;
			const latestCachePublish = await core.Cache.getByPrefix(key) as number | null;
			const [latestItem] = items.toSorted((a, b) => new SupiDate(b.isoDate).valueOf() - new SupiDate(a.isoDate).valueOf());
			await core.Cache.setByPrefix(key, new SupiDate(latestItem.isoDate).valueOf());

			if (!latestCachePublish) {
				continue;
			}

			const newItems = items.filter(i => new SupiDate(i.isoDate).valueOf() > latestCachePublish);
			if (newItems.length === 0) {
				continue;
			}

			const strings = [];
			for (const item of newItems) {
				if (!("id" in item) || typeof item.id !== "string") {
					continue;
				}

				const id = item.id.split(":").at(-1); // "yt:video:<link>"
				if (!id) {
					continue;
				}

				strings.push(`${item.title} https://youtu.be/${id}`);
			}

			channelVideosMap.set(channelId, strings);
			updatedChannels.add(channelId);
		}

		if (channelVideosMap.size === 0) {
			return;
		}

		for (const [userId, channelIds] of userChannelMap) {
			const relevantChannelIds = channelIds.intersection(updatedChannels);
			if (relevantChannelIds.size === 0) {
				continue;
			}

			const userStrings = [];
			for (const updateChannelId of relevantChannelIds) {
				const handle = channelHandleMap.get(updateChannelId);
				const channelStrings = channelVideosMap.get(updateChannelId);
				if (!handle || !channelStrings) {
					throw new SupiError({
						message: "Assert error: Managed channel ID strings and/or handle are not available",
						args: { updateChannelId, userId }
					});
				}

				userStrings.push(`${handle}: ${channelStrings.length} new videos: ${channelStrings.join(" ")}`);
			}

			const userData = await sb.User.getAsserted(userId);
			const platform = userPlatformMap.get(userId);
			if (!platform) {
				throw new SupiError({
					message: "Assert error: User platform does not exist"
				});
			}

			const content = userStrings.join(" -- ");
			await platform.pm(`New YouTube video(s)! ${content}`, userData, null);
		}
	})
} satisfies CronDefinition;
