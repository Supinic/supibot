import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";
import { ivrErrorSchema, ivrSubAgeSchema } from "../../utils/schemas.js";
import type { Platform } from "../../platforms/template.js";
import type { User } from "../../classes/user.js";

const getTargetName = (username: string, user: User, platform: Platform) => {
	if (username === user.Name) {
		return "You are";
	}
	else if (username === platform.selfName) {
		return "I am";
	}
	else {
		return `User ${username} is`;
	}
};

export default declare({
	Name: "subage",
	Aliases: ["sa"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the subscription data for a given user on a given channel on Twitch.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function subAge (context, user?: string, channel?: string) {
		const platform = sb.Platform.getAsserted("twitch");
		const username = sb.User.normalizeUsername(user ?? context.user.Name);

		const userID = await platform.getUserID(username);
		if (!userID) {
			return {
				success: false,
				reply: `User ${username} does not exist on Twitch, or is banned!`
			};
		}

		let channelName = channel;
		if (!channelName) {
			if (context.platform.name !== "twitch") {
				return {
					success: false,
					reply: `When not in a Twitch channel, a specific channel name must be provided!`
				};
			}
			else if (!context.channel) {
				return {
					success: false,
					reply: `When in private messages, a specific channel name must be provided!`
				};
			}

			channelName = context.channel.Name;
		}

		const channelID = await platform.getUserID(sb.User.normalizeUsername(channelName));
		if (!channelID) {
			return {
				success: false,
				reply: `Channel ${username} does not exist on Twitch, or is banned!`
			};
		}

		const response = await core.Got.get("IVR")({
			url: `v2/twitch/subage/${username}/${channelName}`
		});

		if (!response.ok) {
			const { data } = ivrErrorSchema.safeParse(response.body);
			const { message = "(no error message)" } = data?.error ?? {};

			let resultMessage = message;
			if (message.startsWith("Channel has been banned")) {
				resultMessage = `@${channelName} is currently banned`;
			}
			else if (message.startsWith("User has been banned")) {
				resultMessage = `@${username} is currently banned`;
			}

			return {
				success: false,
				reply: `Could not check for followage! Reason: ${resultMessage}`
			};
		}

		let channelString;
		if (channelName === context.user.Name && username === channelName) {
			channelString = "yourself";
		}
		else if (channelName === context.platform.Self_Name && username === channelName) {
			channelString = "myself";
		}
		else if (channelName === context.user.Name) {
			channelString = "you";
		}
		else if (channelName === context.platform.Self_Name) {
			channelString = "me";
		}
		else {
			channelString = channelName;
		}

		const { streak, cumulative, meta, statusHidden } = ivrSubAgeSchema.parse(response.body);
		const who = getTargetName(username, context.user, context.platform);
		if (statusHidden) {
			return {
				success: true,
				reply: `${who} currently hiding subscription status.`
			};
		}
		else if (statusHidden === null) {
			return {
				success: false,
				reply: `Channel ${channelName} is not affliated nor partnered!`
			};
		}

		// Not currently subscribed
		if (!streak || !meta) {
			const verb = (who.startsWith("User")) ? "has" : "have";
			if (!cumulative) {
				return {
					success: true,
					reply: `${who} not subscribed to ${channelString}, and never ${verb} been.`
				};
			}

			const { months } = cumulative;
			return {
				success: false,
				reply: `${who} not subscribed to ${channelString}, but used to be subscribed for ${months} months.`
			};
		}

		if (!cumulative) {
			throw new SupiError({
				message: "Assert error: `cumulative` does not exist"
			});
		}

		let giftString = "";
		const { months } = cumulative;
		const { giftMeta, tier } = meta;
		if (giftMeta) {
			giftString = (giftMeta.gifter)
				? ` gifted by ${giftMeta.gifter.displayName}`
				: ` gifted by anonymous gifter`;
		}

		return {
			reply: core.Utils.tag.trim `
				${who} subscribed to ${channelString}
				for ${months} months in total
				with a Tier ${tier} subscription${giftString}.
			`
		};
	},
	Dynamic_Description: (prefix) => [
		"Shows the current subscription status for you or someone else to the current channel or any other provided.",
		"",

		`<code>${prefix}subage</code>`,
		`<code>${prefix}sa</code>`,
		"Shows your current subscription status to the channel you're using this command in.",
		"Won't work in whispers if used like this - there's no channel to default to.",
		"",

		`<code>${prefix}subage (user)</code>`,
		"Shows that user's current subscription status to the channel you're using this command in.",
		"Again, won't work in whispers",
		"",

		`<code>${prefix}subage (user) (channel)</code>`,
		"Shows that user's current subscription status to the channel you provided.",
		"Will work in whispers as well, since you provided the channel specifically."
	]
});
