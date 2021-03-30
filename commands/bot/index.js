module.exports = {
	Name: "bot",
	Aliases: null,
	Author: "supinic",
	Cooldown: 2500,
	Description: "Allows broadcasters to set various parameters for the bot in their own channel. Usable anywhere, but only applies to their own channel.",
	Flags: ["mention","pipe","skip-banphrase","use-params"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "mode", type: "string" },
		{ name: "url", type: "string" },
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		allowedModes: [
			{
				name: "Ignore",
				description: "Will send the message as if there was no API configured."
			},
			{
				name: "Notify", 
				description: "Will send the message regardless, but adds a little warning emoji ⚠",
			},
			{
				name: "Nothing", 
				description: "Will not reply at all.",
			},
			{
				name: "Refuse",
				description: "Will reply with a message warning that the API did not respond."
			},
			{
				name: "Whisper",
				description: "Won't reply in the main channel at all, but the response will be whispered to target user."
			}
		]
	})),
	Code: (async function bot (context, command) {
		const { params } = context;
		if (!command) {
			return {
				success: false,
				reply: "No sub-command provided! Check the command's extended help for more info."
			};
		}
	
		const channelData = (params.channel)
			? sb.Channel.get(params.channel)
			: context.channel;
	
		if (!channelData) {
			return {
				success: false,
				reply: "Invalid or no channel provided!"
			};
		}
	
		const hasAccess = (
			context.user.Data.administrator
			|| await channelData.isUserChannelOwner(context.user)
			|| channelData.isUserAmbassador(context.user)
		);
	
		if (!hasAccess) {
			return {
				success: false,
				reply: "You're not authorized to do that!"
			};
		}
	
		command = command.toLowerCase();
		switch (command) {
			case "disable":
				if (channelData.Mode === "Read") {
					return {
						success: false,
						reply: "That channel is already set to read-only mode!"
					};
				}
	
				setTimeout(() => channelData.Mode = "Read", 5000);
				return {
					reply: sb.Utils.tag.trim `
						I will go to read-only mode in #${channelData.Name} in 5 seconds.
						Use the "${sb.Command.prefix}${this.Name} enable ${channelData.Name}" command in private messages to re-enable me.
					`
				};
	
			case "enable":
				if (channelData.Mode !== "Read") {
					return {
						success: false,
						reply: "I'm already active in that channel!"
					};
				}
	
				channelData.Mode = "Write";
				return {
					reply: "I successfully disabled read-only mode and will respond to messages again."
				};
	
			case "api":
			case "banphrase":
			case "banphrase-api": {
				const result = [];
				if (params.url) {
					if (params.url === "none") {
						channelData.saveProperty("Banphrase_API_URL", null);
						channelData.saveProperty("Banphrase_API_Type", null);
						result.push("Banphrase API URL has been unset.");
					}
					else {
						const url = require("url");
						const fixedURL = url.parse(params.url).hostname ?? params.url;
						try {
							await sb.Banphrase.executeExternalAPI("test", "Pajbot", fixedURL);
						}
						catch {
							return {
								success: false,
								reply: "Banphrase API URL is not valid - no response received!"
							}
						}
	
						channelData.saveProperty("Banphrase_API_URL", fixedURL);
						channelData.saveProperty("Banphrase_API_Type", "Pajbot");
						result.push(`Banphrase API URL has been set to ${fixedURL}.`);
					}
				}
	
				if (params.mode) {
					params.mode = sb.Utils.capitalize(params.mode.toLowerCase());
					const found = this.staticData.allowedModes.find(i => i.name === params.mode);
					if (!found) {
						const allowedTypes = this.staticData.allowedModes.map(i => i.name).join(", ");
						return {
							success: false,
							reply: "Banphrase API mode is not allowed! Use one of: " + allowedTypes
						};
					}
	
					channelData.saveProperty("Banphrase_API_Downtime", params.mode);
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
				const moduleData = sb.ChatModule.get("offline-only-mode");
				const check = await sb.Query.getRecordset(rs => rs
				    .select("1")
				    .from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %n", moduleData.ID)
					.single()
					.flat("ID")
				);
				
				if (check) {
					return {
						success: false,
						reply: `The offline-only mode has already been activated in this channel!`
					};
				}

				const row = await sb.Query.getRow("chat_data", "Channel_Chat_Module");
				row.setValues({
					Channel: channelData.ID,
					Chat_Module: moduleData.ID
				});
				await row.save();

				await sb.Channel.reloadSpecific(channelData);
				return {
					reply: `Channel ${channelData.Name} is now in offline-only mode.`
				};
			}
			case "disable-offline-only": {
				const moduleData = sb.ChatModule.get("offline-only-mode");
				const check = await sb.Query.getRecordset(rs => rs
					.select("1")
					.from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %n", moduleData.ID)
					.single()
					.flat("ID")
				);

				if (!check) {
					return {
						success: false,
						reply: `The offline-only mode has not been activated in this channel before!`
					};
				}

				await sb.Query.getRecordDeleter(rd => rd
					.delete()
					.from("chat_data", "Channel_Chat_Module")
					.where("Channel = %n", channelData.ID)
					.where("Chat_Module = %n", moduleData.ID)
				);

				await sb.Channel.reloadSpecific(channelData);
				return {
					reply: `Channel ${channelData.Name} is now no longer in offline-only mode.`
				};
			}
	
			default: return {
				success: false,
				reply: "Invalid command provided!"
			}
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { allowedModes } = values.getStaticData();
		const list = allowedModes.map(i => `<li><code>${i.name}</code><br>${i.description}</li><br>`).join("");
	
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
			"Activates (or deactives, if used with disable-) the offline-only mode, which will make Supibot unresponsive in the channel when the streamer goes live.",
			"After the stream ends, Supibot will automatically reactivate. There might be delay up to 2 minutes for both online/offline events.",
			"Note: The stream must go online/offline for this mode to activate. If it is already live, Supibot won't deactivate until it goes live again in the future.",
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
			`<ul>${list}</ul>`
		];
	})
};