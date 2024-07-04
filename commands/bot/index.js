const ALLOWED_MODES = [
	{
		name: "Ignore",
		description: "Will send the message as if there was no API configured."
	},
	{
		name: "Notify",
		description: "Will send the message regardless, but adds a little warning emoji ⚠"
	},
	{
		name: "Nothing",
		description: "Will not reply at all."
	},
	{
		name: "Refuse",
		description: "Will reply with a message warning that the API did not respond."
	},
	{
		name: "Whisper",
		description: "Won't reply in the main channel at all, but the response will be private messaged to target user."
	}
];

module.exports = {
	Name: "bot",
	Aliases: null,
	Author: "supinic",
	Cooldown: 2500,
	Description: "Allows channel owners and Supibot ambassadors to set various parameters for the bot, for their managed channel.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "mode", type: "string" },
		{ name: "url", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function bot (context, command, value) {
		const { params } = context;
		if (!command) {
			return {
				success: false,
				reply: "No sub-command provided! Check the command's extended help for more info."
			};
		}

		const channelData = (params.channel || value)
			? sb.Channel.get(params.channel ?? value)
			: context.channel;

		if (!channelData) {
			const channelName = params.channel ?? value ?? context.channel?.Name ?? null;
			if (command.includes("join") && channelName && channelName.toLowerCase() === context.user.Name) {
				return {
					success: false,
					reply: `I can't rejoin your channel, you haven't requested me yet! To request me in your channel, use this form: https://supinic.com/bot/request-bot/form`
				};
			}

			return {
				success: false,
				reply: "Invalid or no channel provided!"
			};
		}

		const channelString = `channel "${channelData.Name}"`;
		const permissions = await context.getUserPermissions({ channel: channelData });
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					You're not authorized to do that in ${channelString}!
					You should ask the broadcaster or an ambassador to do this instead.
					If you want a different channel, use the channel:channel_name parameter.
				`
			};
		}

		command = command.toLowerCase();
		switch (command) {
			case "disable": {
				if (channelData.Mode === "Read") {
					return {
						success: false,
						reply: "That channel is already set to read-only mode!"
					};
				}

				setTimeout(() => (channelData.Mode = "Read"), 5000);
				return {
					reply: sb.Utils.tag.trim `
						I will go to read-only mode in ${channelString} after ~5 seconds.
						Use the "${sb.Command.prefix}${this.Name} enable ${channelData.Name}" command in private messages to re-enable me.
					`
				};
			}

			case "enable": {
				if (channelData.Mode !== "Read") {
					return {
						success: false,
						reply: `I'm already active in ${channelString}!`
					};
				}

				channelData.Mode = "Write";
				return {
					reply: "I successfully disabled read-only mode and will respond to messages again."
				};
			}

			case "api":
			case "banphrase":
			case "banphrase-api": {
				const result = [];
				if (params.url) {
					if (params.url === "none") {
						await channelData.saveProperty("Banphrase_API_URL", null);
						await channelData.saveProperty("Banphrase_API_Type", null);
						result.push("Banphrase API URL has been unset.");
					}
					else {
						const url = require("node:url");
						const fixedURL = url.parse(params.url).hostname ?? params.url;
						try {
							await sb.Banphrase.executeExternalAPI("test", "pajbot", fixedURL);
						}
						catch {
							return {
								success: false,
								reply: "Banphrase API URL is not valid - no response received!"
							};
						}

						await channelData.saveProperty("Banphrase_API_URL", fixedURL);
						await channelData.saveProperty("Banphrase_API_Type", "Pajbot");
						result.push(`Banphrase API URL has been set to ${fixedURL}.`);
					}
				}

				if (params.mode) {
					params.mode = sb.Utils.capitalize(params.mode.toLowerCase());
					const found = ALLOWED_MODES.find(i => i.name === params.mode);
					if (!found) {
						const allowedTypes = ALLOWED_MODES.map(i => i.name).join(", ");
						return {
							success: false,
							reply: `Banphrase API mode is not allowed! Use one of: ${allowedTypes}`
						};
					}

					await channelData.saveProperty("Banphrase_API_Downtime", params.mode);
					result.push(`Banphrase API mode has been set to ${params.mode}.`);
				}

				if (result.length === 0) {
					return {
						success: false,
						reply: "No changes have been made!"
					};
				}
				else {
					return {
						reply: result.join(" ")
					};
				}
			}

			case "offline-only": {
				if (!channelData) {
					return {
						success: false,
						reply: `No channel has been specified!`
					};
				}

				const moduleData = sb.ChatModule.get("offline-only-mode");
				const check = await sb.Query.getRecordset(rs => rs
					.select("1")
					.from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %s", moduleData.Name)
					.single()
					.flat("1")
				);

				if (check) {
					return {
						success: false,
						reply: `The offline-only mode has already been activated in ${channelString}!`
					};
				}

				const row = await sb.Query.getRow("chat_data", "Channel_Chat_Module");
				row.setValues({
					Channel: channelData.ID,
					Chat_Module: moduleData.Name
				});
				await row.save();

				await sb.Channel.reloadSpecific(channelData);
				return {
					reply: `Channel ${channelData.Name} is now in offline-only mode.`
				};
			}
			case "disable-offline-only": {
				if (!channelData) {
					return {
						success: false,
						reply: `No channel has been specified!`
					};
				}

				const moduleData = sb.ChatModule.get("offline-only-mode");
				const check = await sb.Query.getRecordset(rs => rs
					.select("1")
					.from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %s", moduleData.Name)
					.single()
					.flat("1")
				);

				if (!check) {
					return {
						success: false,
						reply: `The offline-only mode has not been activated in ${channelString} before!`
					};
				}

				await sb.Query.getRecordDeleter(rd => rd
					.delete()
					.from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %s", moduleData.Name)
				);

				await sb.Channel.reloadSpecific(channelData);
				return {
					reply: `${sb.Utils.capitalize(channelString)} is now no longer in offline-only mode.`
				};
			}

			case "rejoin":
			case "i-will-not-ban-supibot-again": {
				if (channelData.Platform.Name !== "twitch") {
					return {
						success: false,
						reply: `Re-enabling the bot is currently only available for Twitch channels!`
					};
				}

				const inactiveReason = await channelData.getDataProperty("inactiveReason");
				if (inactiveReason === "bot-banned" && command !== "i-will-not-ban-supibot-again") {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							I have been banned in ${channelString} for too long!
							You must use this command instead → $bot i-will-not-ban-supibot-again channel:${channelData.Name}
						`
					};
				}
				else if (inactiveReason === "withdrawn") {
					return {
						success: false,
						cooldown: 60_000,
						reply: `I have been withdrawn from this channel and cannot be re-added back manually!`
					};
				}

				const offlineConfiguration = await channelData.getDataProperty("offlineOnlyBot");
				if (channelData.Mode === "Read" && offlineConfiguration) {
					await channelData.setDataProperty("offlineOnlyBot", null);
					await channelData.saveProperty("Mode", offlineConfiguration.mode ?? "Write");

					return {
						reply: sb.Utils.tag.trim `
							I rejoined ${channelString} immediately.
							It was in read-only mode because someone used "$bot disable" before.
							Next time, you can just do "$bot enable".
						`
					};
				}

				const twitch = sb.Platform.get("twitch");
				const results = await twitch.joinChannel(channelData.Specific_ID);
				const [messageResponse, onlineResponse, offlineResponse] = results.map(i => i.response);

				if (messageResponse.ok) {
					if (channelData.Mode === "Inactive") {
						await channelData.setProperty("Mode", "Write");
					}

					const hasNoScopeProperty = await channelData.getDataProperty("twitchNoScopeDisabled");
					if (hasNoScopeProperty) {
						await channelData.setDataProperty("twitchNoScopeDisabled", null);
					}

					return {
						reply: `Rejoined channel ${channelString} successfully.`
					};
				}
				else if (messageResponse.statusCode === 403) {
					return {
						success: false,
						reply: `I could not rejoin channel ${channelString}! Make sure to either permit me via Supinic's website or set me as a moderator.`
					};
				}
				else if (messageResponse.statusCode === 409) {
					if (onlineResponse.statusCode === 202 || offlineResponse.statusCode === 202) {
						return {
							reply: `My message connection was already set up, but I set up checking for when the stream goes online or offline.`
						};
					}

					return {
						success: false,
						reply: "My connections are already set up, everything should work fine!"
					};
				}
				else {
					return {
						success: false,
						reply: `Something else went wrong when trying to rejoin! Try again later.`
					};
				}
			}

			case "enable-links":
			case "disable-links": {
				const verb = command.replace("-links", "");
				const current = channelData.Links_Allowed;
				if ((current && command === "enable-links") || (!current && command === "disable-links")) {
					return {
						success: false,
						reply: `Links are already ${verb}d in ${channelString}!`
					};
				}

				await channelData.saveProperty("Links_Allowed", !current);
				return {
					reply: `Links are now ${verb}d in ${channelString}.`
				};
			}

			case "rename":
			case "renamed": {
				if (channelData.Platform.Name !== "twitch") {
					return {
						success: false,
						reply: `Adding me back to recently renamed channels is only available on Twitch!`
					};
				}
				else {
					return {
						success: false,
						reply: `Ideally, you should never need to do this anymore! 😊`
					};
				}
			}

			case "enable-global-emotes":
			case "disable-global-emotes": {
				if (channelData.Platform.Name !== "discord") {
					return {
						success: false,
						reply: `Cannot set the global emotes configuration in channels outside of Discord!`
					};
				}

				const currentValue = await channelData.getDataProperty("disableDiscordGlobalEmotes");
				if (currentValue === true && command.includes("disable")) {
					return {
						success: false,
						reply: `Global emotes are already disabled in this channel!`
					};
				}
				else if (!currentValue && command.includes("enable")) {
					return {
						success: false,
						reply: `Global emotes are already enabled in this channel!`
					};
				}

				const newValue = !currentValue;
				await channelData.setDataProperty("disableDiscordGlobalEmotes", newValue);
				const verb = (newValue) ? "disabled" : "re-enabled";

				return {
					reply: `Global emotes have been ${verb} in this channel successfully.`
				};
			}

			case "enable-rustlog": {
				if (channelData.Platform.Name !== "twitch") {
					return {
						success: false,
						reply: ``
					};
				}

				let Rustlog;
				try {
					Rustlog = require("../randomline/rustlog.js");
				}
				catch {
					return {
						success: false,
						reply: `Could not load Rustlog methods module!`
					};
				}

				const channelID = channelData.Specific_ID;
				if (await Rustlog.isSupported(channelID)) {
					return {
						success: false,
						reply: `This channel is already added and configured in Rustlog!`
					};
				}

				const { reason, success, statusCode } = await Rustlog.addChannel(channelID);
				if (success) {
					return {
						reply: sb.Utils.tag.trim `
							Successfully added this channel to the Rustlog service!
							The $rl command should be enabled within approximately one minute.
						`
					};
				}
				else if (statusCode === 401 || reason === "no-key") {
					return {
						success: false,
						reply: "Authentication failure!"
					};
				}
				else if (statusCode === 403) {
					return {
						success: false,
						reply: `Cannot add this channel, as the owner has opted out from being logged by the Rustlog service!`
					};
				}
				else {
					return {
						success: false,
						reply: `Unexpected error occurred! Try again later. Status code: ${statusCode}`
					};
				}
			}

			default: return {
				success: false,
				reply: "Invalid command provided!"
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const list = ALLOWED_MODES.map(i => `<li><code>${i.name}</code><br>${i.description}</li><br>`).join("");

		return [
			"Various bot configuration related commands.",
			"For a given channel, only its owner or ambassadors can use this command.",
			`All sub-commands listed accept the "channel:(name)" parameter, if you want to configure a channel outside of the channel itself.`,
			"",

			`<code>${prefix}bot disable</code>`,
			`<code>${prefix}bot disable channel:(name)</code>`,
			"After a 5 second timeout, disables the bot given channel until enabled again.",
			"If no channel is provided, the current is used.",
			"",

			`<code>${prefix}bot enable supinic</code>`,
			`<code>${prefix}bot enable channel:(name)</code>`,
			"If the bot has been disabled in the given channel, this will re-enable it.",
			"",

			`<code>${prefix}bot offline-only</code>`,
			`<code>${prefix}bot disable-offline-only</code>`,
			`<code>${prefix}bot offline-only channel:(name)</code>`,
			"Activates (or deactivates, if used with disable-) the offline-only mode, which will make Supibot unresponsive in the channel when the streamer goes live.",
			"After the stream ends, Supibot will automatically reactivate. There might be delay up to 2 minutes for both online/offline events.",
			"Note: The stream must go online/offline for this mode to activate. If it is already live, Supibot won't deactivate until it goes live again in the future.",
			"",

			`<code>${prefix}bot enable-rustlog</code>`,
			`<code>${prefix}bot enable-rustlog channel:(channel)</code>`,
			"Enables the 3rd party Rustlog service in either the current, or in a provided channel.",
			`This service gathers the chat logs in the channel, which are then used in Supibot for the <code>$randomline</code> command.`,
			"",

			`<code>${prefix}bot api url:(link) mode:(mode)</code>`,
			`<code>${prefix}bot api channel:(channel) url:(link) mode:(mode)</code>`,
			`Configures the channel's Pajbot banphrase API. You can use one of: "api", "banphrase", "banphrase-api" for the sub-command.`,
			"You can change the URL, but it has to reply properly to a test message.",
			`You can unset the URL by using "url:none".`,
			"",

			"You can also change the mode of Supibot's behaviour when the API times out.",
			"Modes:",
			"",
			`<ul>${list}</ul>`,

			`<code>${prefix}bot enable-links</code>`,
			`<code>${prefix}bot disable-links</code>`,
			`<code>${prefix}bot enable-links channel:(channel)</code>`,
			`<code>${prefix}bot disable-links channel:(channel)</code>`,
			"Disables or enables automatic replacement of all links in a channel.",
			`If enabled, all links will be replaced by "[LINK]" or a similar placeholder.`,
			"",

			`<code>${prefix}bot rename channel:(channel)</code>`,
			`<code>${prefix}bot renamed channel:(channel)</code>`,
			"If you recently renamed your Twitch account, you can use this command to get Supibot back immediately!",
			"This also works for other channels that you are an ambassador in.",
			"",

			`<code>${prefix}bot disable-global-emotes channel:(channel)</code>`,
			`<code>${prefix}bot enable-global-emotes channel:(channel)</code>`,
			"Disables (or re-enables, respectively) the automatic usage of global Discord emotes in the current channel.",
			"Supibot has access to all emotes from all servers it's on, and these might prove to be annoying somewhat.",
			"This configuration lets you disable those, only the ones from the current server will be used.",
			"",

			`<code>${prefix}bot rejoin channel:(channel)</code>`,
			"If your Twitch channel got suspended and recently unbanned, you can use this command to get Supibot back immediately!",
			"This also works for other channels that you are an ambassador in.",
			"",

			`<code>${prefix}bot i-will-not-ban-supibot-again channel:(channel)</code>`,
			`If the bot has been banned in the channel, and unbanned rather quickly (not more than ~1 hour), you can use this command to attempt to have Supibot re-join.`,
			"Should the ban last for too long, Supibot will be unable to join automatically.",
			"It will then mention that you have to create a suggestion and describe what happened."
		];
	})
};
