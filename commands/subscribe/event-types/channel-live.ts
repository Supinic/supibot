import type { Channel } from "../../../classes/channel.js";
import type { SpecialEventDefinition } from "../generic-event.js";

type ChannelsSubData = {
	channels?: Channel["ID"][];
};

export default {
	name: "Channel live",
	aliases: ["live", "online"],
	notes: "Usage: <code>subscribe/unsubscribe live (channel)</code> Every time a channel with Supibot in their chat goes live, users with this subscription for the specific channel will be notified of this via PMs.",
	channelSpecificMention: false,
	generic: false,
	type: "special",
	handler: async function (context, subscription, ...args) {
		const { invocation } = context;
		if (!subscription.loaded) {
			if (invocation === "subscribe") {
				subscription.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Platform: context.platform.ID,
					Type: "Channel live",
					Data: "{}",
					Active: true
				});

				await subscription.save();
			}
			else if (invocation === "unsubscribe") {
				return {
					success: false,
					reply: "You're not subscribed yet, and can't unsubscribe!"
				};
			}
		}

		const data = JSON.parse(subscription.values.Data ?? "{}") as ChannelsSubData;
		data.channels = data.channels ?? [];

		const twitch = sb.Platform.getAsserted("twitch");
		const channels = args
			.map(i => sb.Channel.get(i.toLowerCase(), twitch))
			.filter(i => i !== null && i.Mode !== "Inactive")
			.map(i => (i as Channel).ID);

		if (channels.length === 0) {
			if (invocation === "unsubscribe") {
				subscription.values.Active = false;
				subscription.values.Data = null;
				await subscription.save();

				return {
					success: true,
					reply: "Successfully unsubscribed from all channels going live."
				};
			}
			else if (args.length === 0) {
				const channelList = data.channels.map(i => sb.Channel.get(i)?.Name ?? "").filter(Boolean);
				return {
					success: true,
					reply: (data.channels.length === 0)
						? "You're not subscribed to any channels."
						: `You're subscribed to these ${data.channels.length} channels: ${channelList.join(", ")}`
				};
			}
			else {
				return {
					success: false,
					reply: "No proper channels provided! You can only subscribe to channels with Supibot."
				};
			}
		}

		let response;
		const lengthBefore = data.channels.length;
		if (invocation === "subscribe") {
			data.channels.push(...channels);
			data.channels = data.channels.filter((i, ind, arr) => arr.indexOf(i) === ind);

			response = (data.channels.length > lengthBefore)
				? `Successfully subscribed to ${data.channels.length - lengthBefore} channels going live.`
				: "You did not subscribe to any new channels.";
		}
		else {
			data.channels = data.channels.filter(i => !channels.includes(i));

			response = (data.channels.length < lengthBefore)
				? `Successfully unsubscribed from ${lengthBefore - data.channels.length} channels going live.`
				: "You did not unsubscribe from any channels.";
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
