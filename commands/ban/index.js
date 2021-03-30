module.exports = {
	Name: "ban",
	Aliases: ["unban"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Bans/unbans any combination of channel, user, and command from being executed. Only usable by administrators, or Twitch channel owners.",
	Flags: ["mention","system","use-params"],
	Params: [
        { name: "channel", type: "string" },
        { name: "command", type: "string" },
        { name: "invocation", type: "string" },
        { name: "user", type: "string" },

    ],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function ban (context) {
		// if (context.platform.Name !== "twitch") {
		// 	return {
		// 		success: false,
		// 		reply: "Not available outside of Twitch!"
		// 	};
		// }

		const { invocation } = context;
		const options = {
			Channel: null,
			User_Alias: null,
			Command: null,
			Invocation: null,
			Type: "Blacklist",
			Response: "None",
			Reason: null,
			Issued_By: context.user.ID
		};

		if (context.params.channel) {
            const channelData = sb.Channel.get(context.params.channel);
            if (!channelData) {
                return {
                    success: false,
                    reply: "Channel was not found!"
                };
            }

            options.Channel = channelData.ID;
        }
        if (context.params.command) {
            const commandData = sb.Command.get(context.params.command);
            if (!commandData) {
                return {
                    success: false,
                    reply: "Command does not exist!"
                };
            }
            else if (commandData === this) {
                const emote = await context.platform.getBestAvailableEmote(context.channel, ["PepeLaugh", "pepeLaugh", "4Head"], "😅");
                return {
                    success: false,
                    reply: `You can't ${invocation} the ${commandData.Name} command! ${emote}`
                };
            }

            options.Command = commandData.ID;
        }
        if (context.params.invocation) {
            const commandData = sb.Command.get(context.params.invocation);
            if (!commandData) {
                return {
                    success: false,
                    reply: "No command found for given invocation!"
                };
            }
            else if (commandData === this) {
                const emote = await context.platform.getBestAvailableEmote(context.channel, ["PepeLaugh", "pepeLaugh", "4Head"], "😅");
                return {
                    success: false,
                    reply: `You can't ${invocation} the ${commandData.Name} command's invocation! ${emote}`
                };
            }

            if (!options.Command) {
                options.Command = commandData.ID;
            }
            else if (options.Command !== commandData.ID) {
                return {
                    success: false,
                    reply: "Invalid command + invocation provided! Either keep command: empty, or use the command that belongs to the provided invocation"
                };
            }

            options.Invocation = context.params.invocation;
        }
        if (context.params.user) {
            const userData = await sb.User.get(context.params.user);
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

		let level = null;
		if (context.user.Data.administrator) {
			level = "administrator";
		}
		else if (
			context.channel
			&& (await context.channel.isUserChannelOwner(context.user) || context.channel.isUserAmbassador(context.user))
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
			else if (await channelData.isUserChannelOwner(context.user) || channelData.isUserAmbassador(context.user)) {
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
			&& i.Invocation === options.Invocation
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