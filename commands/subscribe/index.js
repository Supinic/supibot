module.exports = {
	Name: "subscribe",
	Aliases: ["unsubscribe"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Subscribe or unsubscribe to a plethora of events, such as a channel going live, or a suggestion you made being updated. Check the extended help for detailed info on each event.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function subscribe (context, type, ...args) {
		if (!type) {
			return {
				success: false,
				reply: "No event provided! Check the command's extended help for a list."
			};
		}

		type = type.toLowerCase();
		const eventDefinitions = require("./event-types/index.js");
		const event = eventDefinitions.find(i => i.name === type || i.aliases.includes(type));
		if (!event) {
			return {
				success: false,
				reply: "Incorrect event provided! Check the extended command's help for a list."
			};
		}

		/** @type {{ ID: number, Active: boolean }} */
		const subData = await sb.Query.getRecordset(rs => rs
			.select("ID", "Active", "Channel", "Platform")
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
		const location = (context.channel) ? "in this channel" : `in ${context.platform.Name} PMs`;

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
					reply: `Moved your subscription to ${event.name} from ${previousString} to ${currentString}.`
				};
			}

			// Error response for attempting to repeat an existing state - already (un)subscribed.
			if ((invocation === "subscribe" && subData.Active) || (invocation === "unsubscribe" && !subData.Active)) {
				const preposition = (invocation === "subscribe") ? "to" : "from";
				return {
					success: false,
					reply: `You are already ${invocation}d ${preposition} this event ${location}!`
				};
			}

			await sb.Query.getRecordUpdater(rs => rs
				.update("data", "Event_Subscription")
				.set("Active", !subData.Active)
				.where("ID = %n", subData.ID)
			);

			return {
				reply: `Sucessfully ${invocation}d ${location}. ${response}`
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
				Active: true
			});

			await row.save({ skipLoad: true });
			return {
				reply: `Sucessfully subscribed ${location}. ${response}`
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
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
			"",

			`<code>${prefix}unsubscribe (type)</code>`,
			"You will be unsubscribed from a given event.",
			"",

			"List of available events:",
			`<ul>${typesList}</ul>`
		];
	})
};
