import { CronJob } from "cron";
import { type Context, declare } from "../../classes/command.js";

import subscriptions from "./event-types/index.js";
import { type EventSubscription, handleGenericSubscription, isGenericSubscriptionDefinition } from "./generic-event.js";

const DEFAULT_CRON_EXPRESSION = "0 */5 * * * *";

const crons: Set<CronJob> = new Set();
const subscribeCommandParams = [{ name: "skipPrivateReminder", type: "boolean" }] as const;
export type SubscribeCommandContext = Context<typeof subscribeCommandParams>;

export default declare({
	Name: "subscribe",
	Aliases: ["unsubscribe"],
	Cooldown: 5000,
	Description: "Subscribe or unsubscribe to a plethora of events, such as a channel going live, or a suggestion you made being updated. Check the extended help for detailed info on each event.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: subscribeCommandParams,
	Whitelist_Response: null,
	initialize: function () {
		for (const def of subscriptions) {
			if (!isGenericSubscriptionDefinition(def)) {
				continue;
			}

			const cronJob = new CronJob(def.cronExpression ?? DEFAULT_CRON_EXPRESSION, () => handleGenericSubscription(def));
			cronJob.start();
			crons.add(cronJob);
		}
	},
	destroy: function () {
		for (const cronJob of crons) {
			void cronJob.stop();
		}

		crons.clear();
	},
	Code: async function subscribe (context, type, ...args) {
		if (!type) {
			return {
				success: false,
				reply: "No event provided! Check the command's extended help for a list."
			};
		}

		type = type.toLowerCase();

		// `i.names` is guaranteed by Zod to be always lowercase
		const event = subscriptions.find(i => i.names.includes(type));
		if (!event) {
			return {
				success: false,
				reply: "Incorrect event provided! Check the extended command's help for a list."
			};
		}

		const subData = await core.Query.getRecordset<EventSubscription | undefined>(rs => rs
			.select("ID", "Active", "Channel", "Platform", "Flags")
			.from("data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", event.title)
			.limit(1)
			.single()
		);

		if ("handler" in event) {
			const subscription = await core.Query.getRow<EventSubscription>("data", "Event_Subscription");
			if (subData?.ID) {
				await subscription.load(subData.ID);
			}

			return event.handler(context, subscription, ...args);
		}

		const { invocation } = context;
		let response: string;
		if ("response" in event && event.response) {
			response = (invocation === "subscribe") ? event.response.added : event.response.removed;
		}
		else {
			response = (invocation === "subscribe")
				? `You are now subscribed to ${event.title}.`
				: `You have unsubscribed from ${event.title}.`;
		}

		let locationWithSpace = "";
		const channelSpecificMention = ("channelSpecificMention" in event) ? event.channelSpecificMention : true;
		if (channelSpecificMention) {
			locationWithSpace = (context.channel)
				? " in this channel"
				: ` in ${context.platform.Name} PMs`;
		}

		const { skipPrivateReminder } = context.params;
		const flags = {
			skipPrivateReminder: Boolean(skipPrivateReminder)
		};

		let flagAppendix = "";
		if (typeof skipPrivateReminder === "boolean") {
			const word = (skipPrivateReminder) ? "will not" : "will";
			flagAppendix = ` Also, you ${word} receive private reminders.`;
		}

		if (subData) {
			// If re-subscribing in a different channel/platform combination, don't error out,
			// but rather update the channel/platform combo.
			const currentChannelID = context.channel?.ID ?? null;
			if (
				channelSpecificMention
				&& invocation === "subscribe"
				&& subData.Active
				&& (subData.Channel !== currentChannelID || subData.Platform !== context.platform.ID)
			) {
				await core.Query.getRecordUpdater(rs => rs
					.update("data", "Event_Subscription")
					.set("Channel", currentChannelID)
					.set("Platform", context.platform.ID)
					.set("Flags", JSON.stringify(flags))
					.where("ID = %n", subData.ID)
				);

				let previousString = "";
				const previousPlatformData = sb.Platform.getAsserted(subData.Platform);
				if (subData.Channel) {
					const previousChannelData = sb.Channel.getAsserted(subData.Channel);
					previousString += `${previousPlatformData.Name} channel ${previousChannelData.Description ?? previousChannelData.Name}`;
				}
				else {
					previousString += `${previousPlatformData.Name} PMs`;
				}

				let currentString = "";
				if (context.channel) {
					currentString += `${context.platform.Name} channel ${context.channel.Description ?? context.channel.Name}`;
				}
				else {
					currentString += `${context.platform.Name} PMs`;
				}

				return {
					success: true,
					reply: `Moved your ${event.title} subscription from ${previousString} to ${currentString}.${flagAppendix}`
				};
			}

			let invocationString = invocation;

			// Error response for attempting to repeat an existing state - already (un)subscribed.
			if ((invocation === "subscribe" && subData.Active) || (invocation === "unsubscribe" && !subData.Active)) {
				const flags = JSON.parse(subData.Flags) as { skipPrivateReminder?: boolean; };
				const storedFlagValue = Boolean(flags.skipPrivateReminder);

				if (storedFlagValue !== flags.skipPrivateReminder) {
					invocationString = "update";
				}
				else {
					const preposition = (invocation === "subscribe") ? "to" : "from";
					return {
						success: false,
						reply: `You are already ${invocationString}d ${preposition} this event${locationWithSpace}!`
					};
				}
			}

			await core.Query.getRecordUpdater(ru => {
				ru.update("data", "Event_Subscription")
					.set("Active", !subData.Active)
					.set("Flags", JSON.stringify(flags))
					.where("ID = %n", subData.ID);

				if (invocation === "subscribe") {
					ru.set("Channel", context.channel?.ID ?? null);
					ru.set("Platform", context.platform.ID);
				}

				return ru;
			});

			return {
				success: true,
				reply: `Successfully ${invocationString}d${locationWithSpace}. ${response}`
			};
		}
		else {
			if (invocation === "unsubscribe") {
				return {
					success: false,
					reply: `You are not subscribed to this event, so you cannot unsubscribe!`
				};
			}

			const row = await core.Query.getRow("data", "Event_Subscription");
			row.setValues({
				User_Alias: context.user.ID,
				Platform: context.platform.ID,
				Channel: context.channel?.ID ?? null,
				Type: event.title,
				Flags: JSON.stringify(flags),
				Active: true
			});

			await row.save({ skipLoad: true });
			return {
				success: true,
				reply: `Successfully subscribed${locationWithSpace}. ${response}${flagAppendix}`
			};
		}
	},
	Dynamic_Description: (prefix) => {
		const tableBody = subscriptions.map(i => {
			const namesString = i.names.join(", ");
			const urlString = ("url" in i) ? `<a href="${i.url}">RSS</a>` : "N/A";
			const notesString = ("notes" in i && i.notes) ? i.notes : "";

			return core.Utils.tag.trim `
				<tr>
					<td>${i.title}</td>
					<td>${namesString}</td>
					<td>${urlString}</td>
					<td>${notesString}			
				</tr>
			`;
		}).join("");

		return [
			"Subscribes or unsubscribes your account from an event in Supibot's database.",
			"Depending on the event, you will be notified in different ways.",
			"",

			`<code>${prefix}subscribe (name)</code>`,
			"You will be subscribed to the given event.",
			"You can re-subscribe in a different channel (without un-subcribing) if you want a specific event to mention you elsewhere",
			"",

			`<code>${prefix}subscribe (name) <u>skipPrivateReminder:(true|false)</u></code>`,
			"You will be subscribed to the given event with the private reminders skipped or unskipped per your choice.",
			"You can also use this on an existing event to change your setting without changing the subscription itself",
			"",

			`<code>${prefix}unsubscribe (name)</code>`,
			"You will be unsubscribed from the given event.",
			"",

			"List of available events:",
			`<table><thead><th style="min-width:50px">Title</th><th>Name</th><th style="min-width:45px">Source</th><th>Notes</th></thead>${tableBody}</table>`,
			""
		];
	}
});
