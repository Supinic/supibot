import * as z from "zod";
import { handleEventSubscription } from "../../commands/subscribe/generic-event.js";
import type { ChatModuleDefinition } from "../../classes/chat-module.js";

const defSchema = z.object({
	channelId: z.string(),
	wordFilters: z.object({
		include: z.array(z.string()).optional(),
		exclude: z.array(z.string()).optional()
	}).optional(),
	subscription: z.string(),
	messagePrefix: z.string()
});

export default {
	Name: "discord-announcement-subscriber",
	Events: ["message"],
	Description: "When listening to a message in a specified Discord channel, Supibot will then create a $subscription like list of reminders and post the news to all affected channels.",
	Code: (async function discordAnnouncementSubscriber (context, ...args) {
		const { channel, message } = context;
		if (!channel || !message) {
			return;
		}

		const definition = defSchema.parse(args[0]);
		const { channelId, wordFilters = {}, subscription, messagePrefix } = definition;
		if (channel.Name !== channelId) { // sanity check
			return;
		}

		let passed = true;
		const { include = [], exclude = [] } = wordFilters;
		if (include.length !== 0) {
			passed = include.some(i => message.includes(i));
		}
		if (exclude.length !== 0) {
			passed = exclude.every(i => !message.includes(i));
		}

		if (!passed) {
			return;
		}

		const subscriptions = await core.Query.getRecordset<number[]>(rs => rs
			.select("ID")
			.from("data", "Event_Subscription")
			.where("Active = %b", true)
			.where("Type = %s", subscription)
			.limit(1)
		);
		if (subscriptions.length === 0) {
			return;
		}

		await handleEventSubscription(subscription, `${messagePrefix}: ${message}`);
	}),
	Global: false,
	Platform: null
} satisfies ChatModuleDefinition;
