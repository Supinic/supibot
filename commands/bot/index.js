module.exports = {
	Name: "bot",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-11T16:48:47.000Z",
	Cooldown: 2500,
	Description: "Allows broadcasters to set various parameters for the bot in their own channel. Usable anywhere, but only applies to their own channel.",
	Flags: ["mention","pipe","skip-banphrase","use-params"],
	Whitelist_Response: null,
	Static_Data: ({
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
	}),
	Code: (async function bot (context, command, ...args) {
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
			|| channelData.isUserChannelOwner(context.user)
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
	
			case "api": {
				const result = [];
				if (params.url) {
					if (params.url === "none") {
						channelData.saveProperty("Banphrase_API_URL", null);
						channelData.saveProperty("Banphrase_API_Type", null);
						result.push("Banphrase API URL has been unset.");
					}
					else {
						try {
							await sb.Banphrase.executeExternalAPI("test", "Pajbot", params.url);
						}
						catch {
							return {
								success: false,
								reply: "Banphrase API URL is not valid - no response received!"
							}
						}
	
						channelData.saveProperty("Banphrase_API_URL", params.url);
						channelData.saveProperty("Banphrase_API_Type", "Pajbot");
						result.push(`Banphrase API URL has been set to ${params.url}.`);
					}
				}
	
				if (params.mode) {
					params.mode = sb.Utils.capitalize(params.mode.toLowerCase());
					const found = this.staticData.allowedModes.find(i => i.name === params.mode);
	
					if (!found) {
						return {
							success: false,
							reply: "Banphrase API mode is not allowed! Use one of: " + this.staticData.allowedModes.join(", ")
						};
					}
	
					channelData.saveProperty("Banphrase_API_URL", (params.url === "none") ? null : params.url);
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
	
			default: return {
				success: false,
				reply: "Invalid command provided!"
			}
		}
	})
	,
	Dynamic_Description: async (prefix, values) => {
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
			
			`<code>${prefix}bot api url:(link) mode:(mode)</code>`,
			`<code>${prefix}bot api channel:(channel) url:(link) mode:(mode)</code>`,
			"Configures the channel's Pajbot banphrase API.",
			"You can change the URL, but it has to reply properly to a test message.",
			`You can unset the URL by using "url:none".`,
			"",
	
			"You can also change the mode of Supibot's behaviour when the API times out.",
			"Modes:",
			"",
			list		
		];
	}
};