module.exports = {
	Name: "ban",
	Aliases: ["unban"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Bans/unbans any combination of channel, user, and command from being executed. Only usable by administrators, or Twitch channel owners.",
	Flags: ["mention","system"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function ban (context, ...args) {
		if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "Not available outside of Twitch!"
			};
		}
	
		const { invocation } = context;
		const options = {
			Channel: null,
			User_Alias: null,
			Command: null,
			Type: "Blacklist",
			Response: "None",
			Reason: null,
			Issued_By: context.user.ID
		};
	
		for (let i = 0; i < args.length; i++) {
			const token = args[i];
			const value = token.split(":")[1];
	
			if (token.includes("channel:")) {
				const channelData = sb.Channel.get(value);
				if (!channelData) {
					return {
						success: false,
						reply: "Channel was not found!"
					};
				}
	
				options.Channel = channelData.ID;
			}
			else if (token.includes("command:")) {
				const commandData = sb.Command.get(value);
				if (!commandData) {
					return {
						success: false,
						reply: "Command does not exist!"
					};
				}
				else if (commandData === this) {
					return {
						success: false,
						reply: `You can't ${invocation} the ${value} command!`
					};
				}
	
				options.Command = commandData.ID;
			}
			else if (token.includes("user:")) {
				const userData = await sb.User.get(value);
				if (!userData) {
					return {
						success: false,
						reply: "User was not found!"
					};
				}
				else if (userData === context.user) {
					return {
						success: false,
						reply: `You can't ${invocation} yourself!`
					};
				}
	
				options.User_Alias = userData.ID;
			}
		}
	
		/** @type {string|null} */
		let level = null;
		if (context.user.Data.administrator) {
			level = "administrator";
		}
		else if (
			context.channel 
			&& (context.channel.isUserChannelOwner(context.user) || context.channel.isUserAmbassador(context.user))
		) {
			level = "channel-owner";
		}
	
		if (!options.Channel) {
			if (level === "administrator") {
				// OK.
			}
			else if (level === "channel-owner") {
				options.Channel = context.channel.ID;
			}
			else {
				return {
					success: false,
					reply: "Can't do that in this channel!"
				};
			}
		}
		else {
			const channelData = sb.Channel.get(options.Channel);
			if (level === "administrator") {
				// OK.
			}
			else if (channelData.isUserChannelOwner(context.user) || channelData.isUserAmbassador(context.user)) {
				level = "channel-owner";
			}
			else {
				return { success: false, reply: "Can't do that for provided channel" }
			}
		}
	
		// if a channel owner doesn't provide a user or a command, then fail
		// if an admin doesn't provide user, command or a channel, then fail
		if (
			(!options.User_Alias && !options.Command)
			&& (level === "channel-owner" || (level === "administrator" && !options.Channel))
		) {
			return {
				success: false,
				reply: "Not enough data provided to create a ban!"
			};
		}
	
		if (level === "channel-owner") {
			options.Response = "Reason";
			options.Reason = "Banned by channel owner.";
		}
	
		const existing = sb.Filter.data.find(i =>
			i.Type === "Blacklist"
			&& i.Channel === options.Channel
			&& i.Command === options.Command
			&& i.User_Alias === options.User_Alias
		);
	
		if (existing) {
			if (existing.Issued_By !== context.user.ID && level !== "administrator") {
				return {
					success: false,
					reply: "This ban has not been created by you, so you cannot modify it!"
				};
			}
			else if ((existing.Active && invocation === "ban") || (!existing.Active && invocation === "unban")) {
				return {
					success: false,
					reply: `That combination is already ${invocation}ned!`
				};
			}
	
			await existing.toggle();
	
			const [prefix, suffix] = (existing.Active) ? ["", " again"] : ["un", ""];
			return {
				reply: `Succesfully ${prefix}banned${suffix}.`
			};
		}
		else {
			if (invocation === "unban") {
				return {
					success: false,
					reply: "This combination has not been banned yet, so it cannot be unbanned!"
				};
			}
	
			const ban = await sb.Filter.create(options);
			return {
				reply: `Succesfully banned (ID ${ban.ID})`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Bans or unbans any combination of user/channel/command.",
			"Only usable by admins or Twitch channel owners. Channel owners can only ban combinations in their channel.",
			"All following examples assume the command is executed by a channel owner.",
			"",
	
			`<code>${prefix}ban user:test command:remind</code>`,
			"Bans user <u>test</u> from executing the command <u>remind</u> in the current channel.",
			"",
	
			`<code>${prefix}ban command:remind</code>`,
			"Bans <u>everyone</u> from executing the command <u>remind</u> in the current channel.",
			"",
	
			`<code>${prefix}ban user:test</code>`,
			"Bans user <u>test</u> from executing <u>any</u> commands in the current channel.",
			"",
	
			"---",
			"",
	
			`<code>${prefix}unban user:test command:remind</code>`,
			"If banned before, user <u>test</u> will be unbanned from executing the command <u>remind</u> in the current channel.",
			"",
	
			`<code>${prefix}unban command:remind</code>`,
			"If banned before, <u>everyone</u> will be unbanned from executing the command <u>remind</u> in the current channel.",
			"",
	
			`<code>${prefix}unban user:test</code>`,
			"If banned before, user <u>test</u> will be unbanned from executing <u>any</u> commands in the current channel."
		];
	})
};