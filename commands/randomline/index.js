module.exports = {
	Name: "randomline",
	Aliases: ["rl","rq"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random line from the current channel. If a user is specified, fetches a random line from that user only. \"rq\" only chooses from your own lines.",
	Flags: ["block","external-input","opt-out","pipe"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		optoutRerollThreshold: 5
	})),
	Code: (async function randomLine (context, user) {
		const DatabaseLogs = require("./db-randomline.js");
		const Justlog = require("./justlog.js");
		const { connectedChannelGroups } = require("./connected-channels.json");

		if (context.channel === null) {
			return {
				reply: "This command cannot be used in private messages!"
			};
		}

		if (context.invocation === "rq") {
			user = context.user.Name;
		}

		let result;
		if (!context.channel.Logging.has("Lines")) {
			if (context.channel.Platform.Name !== "twitch") {
				return {
					success: false,
					reply: `This channel does not support random lines!`
				};
			}

			const channelID = context.channel.Specific_ID;
			const isChannelSupported = await Justlog.isSupported(channelID);
			if (isChannelSupported === null) {
				return {
					success: false,
					reply: `The logging service is currently unavailable! Please try again later.`
				};
			}
			else if (isChannelSupported === false) {
				return {
					success: false,
					reply: `This channel does not currently support random lines!`
				};
			}

			if (user) {
				const { controller } = sb.Platform.get("twitch");
				const userID = await controller.getUserID(user);
				if (!userID) {
					return {
						success: false,
						reply: `That user does not exist!`
					};
				}

				result = await Justlog.getRandomUserLine(channelID, userID);
			}
			else {
				result = await Justlog.getRandomChannelLine(channelID);
			}
		}
		else if (user) {
			const targetUser = await sb.User.get(user);
			if (!targetUser) {
				return {
					success: false,
					reply: "I have not seen that user before, so you cannot check their random lines!"
				};
			}

			const group = connectedChannelGroups.find(i => i.includes(context.channel.ID));
			if (group) {
				result = await DatabaseLogs.fetchGroupUserRandomLine(group, targetUser);
			}
			else {
				result = await DatabaseLogs.fetchUserRandomLine(targetUser, context.channel);
			}
		}
		else {
			const group = connectedChannelGroups.find(i => i.includes(context.channel.ID));
			if (group) {
				result = await DatabaseLogs.fetchGroupChannelRandomLine(group);
			}
			else {
				result = await DatabaseLogs.fetchChannelRandomLine(context.channel);
			}
		}

		if (!result.success) {
			return {
				success: false,
				reply: result.reason
			};
		}

		const partialReplies = [{
			bancheck: true,
			message: result.text
		}];

		// Only add the "(time ago) name:" part if it was not requested to skip it
		if (!context.params.textOnly) {
			partialReplies.unshift(
				{
					bancheck: false,
					message: `(${sb.Utils.timeDelta(result.date)})`
				},
				{
					bancheck: true,
					message: `${result.username}:`
				}
			);
		}

		return {
			partialReplies
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches a random chat line from the current channel.",
		"If you specify a user, the line will be from that user only.",
		"",

		`<code>${prefix}rl</code>`,
		`Random message from anyone, in the format "(time ago) (username): (message)"`,
		"",

		`<code>${prefix}rl (user)</code>`,
		"Random message from specified user only",
		"",

		`<code>${prefix}rq</code>`,
		"Random message from yourself only",
		"",

		`<code>${prefix}rl (user) textOnly:true</code>`,
		`Will only reply with the message, ignoring the "(time ago) (name):" part`,
		""
	])
};
