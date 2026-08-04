import { CHANNEL_LIVE_SUBSCRIPTION_TITLE } from "../../commands/subscribe/event-types/channel-live.js";
import type { ChatModuleDefinition } from "../../classes/chat-module.js";
import type { User } from "../../classes/user.js";
import type { Platform } from "../../platforms/template.js";

type SubData = {
	userId: User["ID"];
	platformId: Platform["ID"];
};

export default {
	Name: "live-detection",
	Events: ["online"],
	Description: "Sends out PMs to all users subbed to the live event, whenever a channel set up there goes live.",
	Code: (async function liveDetection (context) {
		const { channel } = context;
		if (!channel) {
			return; // @todo remove after proper event discrimination ("online" - always has channel)
		}

		const subscriptions = await core.Query.getRecordset<SubData[]>(rs => rs
			.select("User_Alias AS userId", "Platform AS platformId")
			.from("data", "Event_Subscription")
			.where("Active = %b", true)
			.where("Type = %s", CHANNEL_LIVE_SUBSCRIPTION_TITLE)
			.where("JSON_CONTAINS(Data, %n, %s) = %n", channel.ID, "$.channels", 1)
		);

		if (subscriptions.length === 0) {
			return;
		}

		for (const { userId, platformId } of subscriptions) {
			const userData = await sb.User.getAsserted(userId);
			const platformData = sb.Platform.getAsserted(platformId);

			void platformData.pm(`Channel ${channel.Name} has just gone live! https://twitch.tv/${channel.Name}`, userData);
		}
	}),
	Global: true,
	Platform: "twitch"
} satisfies ChatModuleDefinition;
