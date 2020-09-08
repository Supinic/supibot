module.exports = {
	Name: "bot",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T19:34:36.000Z",
	Cooldown: 2500,
	Description: "Allows broadcasters to set various parameters for the bot in their own channel. Usable anywhere, but only applies to their own channel.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function bot (context, command, channel, ...args) {
		if (!command) {
			return {
				success: false,
				reply: "No sub-command provided! Check the command's extended help for more info."
			};
		}
	
		const channelData = (channel)
			? sb.Channel.get(channel)
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
	
			default: return {
				success: false,
				reply: "Invalid command provided!"
			}
		}
	})
	,
	Dynamic_Description: async (prefix) => {
	
		return [
			"Currently, you can enable or disable the bot in your channel.",
			"After disabling, you can enable it again in a different channel. I recommend @supibot - that one is always active.",
			"",
	
			`<code>${prefix}bot disable</code>`,
			"Disables the bot in your channel indefinitely",
			"",
	
			`<code>${prefix}bot enable supinic</code>`,
			"Re-enables the bot in channel <u>supinic</u>",
		];
	}
};