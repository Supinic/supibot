import { fetchSevenTvChannelData } from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";
import type { Channel } from "../../../classes/channel.js";

const set = async (channelData: Channel, ...args: string[]) => {
	const twitch = sb.Platform.getAsserted("twitch");
	const channelPoints = await twitch.fetchChannelPointsData(channelData.Name);
	if (!channelPoints || channelPoints.customRewards.length === 0 || !channelPoints.name) {
		return {
			success: false,
			reply: "This channel does not have any channel point rewards set up!"
		};
	}

	const query = args.join(" ").toLowerCase();
	const targetReward = channelPoints.customRewards.find(i => i.id === query || i.title.toLowerCase() === query);
	if (!targetReward) {
		return {
			success: false,
			reply: "Could not find any reward based on your input! Use either its exact name or its ID."
		};
	}
	else if (!targetReward.isUserInputRequired) {
		return {
			success: false,
			reply: `Cannot use the "${targetReward.title}" reward, because it can be used without any text!`
		};
	}

	const localData = await fetchSevenTvChannelData(channelData);
	localData.addRedemption = {
		id: targetReward.id,
		name: targetReward.title,
		active: true
	};

	await channelData.setDataProperty("sevenTvRotatingEmotes", localData);

	return {
		success: true,
		reply: `Successfully set the "${targetReward.title}" reward as the requirement to use the "add" command.`
	};
};

const unset = async (channelData: Channel) => {
	const localData = await fetchSevenTvChannelData(channelData);
	if (!localData.addRedemption) {
		return {
			success: false,
			reply: "This channel has no reward linked, so you can't unset it!"
		};
	}
	else if (!localData.addRedemption.active) {
		return {
			success: false,
			reply: "This channel's linked reward is already deactivated!"
		};
	}

	localData.addRedemption.active = false;
	await channelData.setDataProperty("sevenTvRotatingEmotes", localData);

	return {
		success: true,
		reply: "Successfully deactivated the linked reward in this channel."
	};
};

export default {
	name: "reward",
	title: "Link/unlink Twitch redemptions",
	aliases: [],
	default: false,
	description: [],
	getDescription: (prefix) => [
		"Links or unlinks the <code>add</code> command from being usable only via a given Twitch channel point reward.",
		`When linked, the <code>${prefix}7tv add</code> command will only be usable when the given points reward is used alongside the command.`,
		"",

		`<code>${prefix}7tv reward add (full name or ID of points reward)</code>`,
		`Links the <code>add</code> command in the current channel to the given points reward.`,
		`You can also use "link" or "set" instead of "add".`,
		"",

		`<code>${prefix}7tv reward remove</code>`,
		"If the command is currently linked to a reward, this will disable the link.",
		`You can also use "unlink" or "unset" instead of "remove".`
	],
	execute: async (context, type, ...args) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const permissions = await context.getUserPermissions();
		if (permissions.flag < sb.User.permissions.ambassador) {
			return {
				success: false,
				reply: "You can't use this command here! Only ambassadors and channel owners can."
			};
		}

		if (type === "add" || type === "set" || type === "link") {
			return await set(context.channel, ...args);
		}
		else if (type === "remove" || type === "unset" || type === "unlink") {
			return await unset(context.channel);
		}

		return {
			success: false,
			reply: `Invalid operation provided! Use one of "add" or "remove".`
		};
	}
} satisfies SevenTvSubcommandDefinition;
