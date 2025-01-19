const { CronJob } = require("cron");
const nameSymbol = Symbol.for("name");
const definitionSymbol = Symbol.for("definition");

export default {
	Name: "subscribe",
	Aliases: ["unsubscribe"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Subscribe or unsubscribe to a plethora of events, such as a channel going live, or a suggestion you made being updated. Check the extended help for detailed info on each event.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "skipPrivateReminder", type: "boolean" }
	],
	Whitelist_Response: null,
	initialize: async function () {
		const rssSubscriptions = require("./event-types/index.js").filter(i => i.generic);
		const { handleGenericSubscription } = require("./generic-event.js");

		this.data.crons = new Set();

		for (const def of rssSubscriptions) {
			const expression = def.cronExpression ?? "0 */5 * * * *";
			const cronJob = new CronJob(expression, () => handleGenericSubscription(def));

			// These symbols are only used for debugging purposes, simplifies the inspection of each cron job
			cronJob[nameSymbol] = def.name ?? null;
			cronJob[definitionSymbol] = def;

			cronJob.start();
			this.data.crons.add(cronJob);
		}
	},
	destroy: function () {
		for (const cronJob of this.data.crons) {
			cronJob.stop();
		}

		this.data.crons.clear();
	},
	Code: async function subscribe (context, type, ...args) {
		if (!type) {
			return {
				success: false,
				reply: "No event provided! Check the command's extended help for a list."
			};
		}

		type = type.toLowerCase();

		const eventDefinitions = require("./event-types/index.js");
		const event = eventDefinitions.find(i => {
			const lowerName = i.name.toLowerCase();
			const lowerAliases = i.aliases.map(j => j.toLowerCase());

			return (lowerName === type || lowerAliases.includes(type));
		});

		if (!event) {
			return {
				success: false,
				reply: "Incorrect event provided! Check the extended command's help for a list."
			};
		}

		/** @type {{ ID: number, Active: boolean }} */
		const subData = await sb.Query.getRecordset(rs => rs
			.select("ID", "Active", "Channel", "Platform", "Flags")
			.from("data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", event.name)
			.limit(1)
			.single()
		);

		if (typeof event.handler === "function") {
			const subscription = await sb.Query.getRow("data", "Event_Subscription");
			if (subData?.ID) {
				await subscription.load(subData.ID);
			}

			return event.handler(context, subscription, ...args);
		}

		const { invocation } = context;
		const response = (invocation === "subscribe") ? event.response.added : event.response.removed;

		let locationWithSpace = "";
		if (event.channelSpecificMention) {
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
				event.channelSpecificMention
				&& invocation === "subscribe"
				&& subData.Active
				&& (subData.Channel !== currentChannelID || subData.Platform !== context.platform.ID)
			) {
				await sb.Query.getRecordUpdater(rs => rs
					.update("data", "Event_Subscription")
					.set("Channel", currentChannelID)
					.set("Platform", context.platform.ID)
					.set("Flags", JSON.stringify(flags))
					.where("ID = %n", subData.ID)
				);

				let previousString = "";
				const previousPlatformData = sb.Platform.get(subData.Platform);
				if (subData.Channel) {
					const previousChannelData = sb.Channel.get(subData.Channel);
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
					reply: `Moved your subscription to ${event.name} from ${previousString} to ${currentString}.${flagAppendix}`
				};
			}

			let invocationString = invocation;

			// Error response for attempting to repeat an existing state - already (un)subscribed.
			if ((invocation === "subscribe" && subData.Active) || (invocation === "unsubscribe" && !subData.Active)) {
				const storedFlagValue = Boolean(JSON.parse(subData.Flags ?? {}).skipPrivateReminder);
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

			await sb.Query.getRecordUpdater(rs => rs
				.update("data", "Event_Subscription")
				.set("Active", !subData.Active)
				.set("Flags", JSON.stringify(flags))
				.where("ID = %n", subData.ID)
			);

			return {
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

			const row = await sb.Query.getRow("data", "Event_Subscription");
			row.setValues({
				User_Alias: context.user.ID,
				Platform: context.platform.ID,
				Channel: context.channel?.ID ?? null,
				Type: event.name,
				Flags: JSON.stringify(flags),
				Active: true
			});

			await row.save({ skipLoad: true });
			return {
				reply: `Successfully subscribed${locationWithSpace}. ${response}${flagAppendix}`
			};
		}
	},
	Dynamic_Description: async function (prefix) {
		const types = require("./event-types/index.js");
		const typesList = types.map(i => sb.Utils.tag.trim `
			<li>
				<code>${i.name}</code>
				<br>Aliases: ${i.aliases.map(j => `<code>${j}</code>`).join(", ") || "(none)"}
				<br>${i.notes}			
			</li>
		`).join("");

		return [
			"Subscribes or unsubscribes your account from an event in Supibot's database.",
			"Depending on the event, you will be notified in different ways.",
			"",

			`<code>${prefix}subscribe (type)</code>`,
			"You will be subscribed to a given event.",
			"You can re-subscribe in a different channel (without un-subcribing) if you want a specific event to mention you elsewhere",
			"",

			`<code>${prefix}subscribe (type) <u>skipPrivateReminder:(true|false)</u></code>`,
			"You will be subscribed to a given event with the private reminders skipped or unskipped per your choice.",
			"You can also use this on an existing event to change your setting without changing the subscription itself",
			"",

			`<code>${prefix}unsubscribe (type)</code>`,
			"You will be unsubscribed from a given event.",
			"",

			"List of available events:",
			`<ul>${typesList}</ul>`
		];
	}
};
