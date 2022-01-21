module.exports = {
	Name: "ban",
	Aliases: ["unban"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Bans/unbans any combination of channel, user, and command from being executed. Only usable by administrators, or Twitch channel owners.",
	Flags: ["mention","use-params"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "clear", type: "boolean" },
		{ name: "command", type: "string" },
		{ name: "index", type: "number" },
		{ name: "invocation", type: "string" },
		{ name: "multiplier", type: "number" },
		{ name: "type", type: "string" },
		{ name: "string", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		availableTypes: ["Arguments", "Blacklist", "Cooldown", "Online-only", "Offline-only", "Reminder-prevention"]
	})),
	Code: (async function ban (context) {
		const { invocation } = context;
		const { availableTypes } = this.staticData;
		const type = sb.Utils.capitalize(context.params.type ?? "Blacklist");
		if (!availableTypes.includes(type)) {
			return {
				success: false,
				reply: `Invalid ban filter type provided! Use one of ${availableTypes.join(", ")}`
			};
		}

		const options = {
			Channel: null,
			User_Alias: null,
			Command: null,
			Invocation: null,
			Type: type,
			Response: "None",
			Reason: null,
			Issued_By: context.user.ID
		};

		if (context.params.channel) {
			const channelData = sb.Channel.get(context.params.channel, context.platform);
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
				const emote = await context.getBestAvailableEmote(["PepeLaugh", "pepeLaugh", "4Head"], "😅");
				return {
					success: false,
					reply: `You can't ${invocation} the ${commandData.Name} command! ${emote}`
				};
			}

			options.Command = commandData.Name;
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
				const emote = await context.getBestAvailableEmote(["PepeLaugh", "pepeLaugh", "4Head"], "😅");
				return {
					success: false,
					reply: `You can't ${invocation} the ${commandData.Name} command's invocation! ${emote}`
				};
			}

			if (!options.Command) {
				options.Command = commandData.Name;
			}
			else if (options.Command !== commandData.Name) {
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
			else if (userData.Name === context.platform.Self_Name) {
				return {
					success: false,
					reply: `You can't do that!`
				};
			}

			options.User_Alias = userData.ID;
		}

		const isAdmin = await context.user.getDataProperty("administrator");
		if (!options.Channel && !isAdmin) {
			if (context.privateMessage) {
				return {
					success: false,
					reply: `When using this command in private messages, you must provide a channel with the "channel:(name)" parameter!`
				};
			}

			options.Channel = context.channel.ID;
		}

		if (options.Channel && !isAdmin) {
			const channelData = sb.Channel.get(options.Channel);
			const permissions = await context.getUserPermissions({
				channel: channelData,
				platform: channelData?.Platform
			});

			if (permissions.flag === sb.User.permissions.regular) {
				return {
					success: false,
					reply: "Can't do that in this channel!"
				};
			}

			const channelPermissions = permissions.is("ambassador") || permissions.is("channelOwner");
			if (!options.User_Alias && !options.Command && channelPermissions) {
				return {
					success: false,
					reply: "Not enough data provided to create a ban! You are missing user and/or command"
				};
			}

			if (channelPermissions) {
				options.Response = "Reason";
				options.Reason = "Banned in this channel.";
			}
		}

		if (!options.User_Alias && !options.Command && !options.Channel && isAdmin) {
			return {
				success: false,
				reply: "Not enough data provided to create a ban! You are missing all idenitifiers."
			};
		}

		if (type === "Reminder-prevention" && (!options.Channel || !options.User_Alias || options.Command || options.Invocation)) {
			return {
				success: false,
				reply: `You must provide the channel and a user (no other params) to create a reminder prevention!`
			};
		}

		const existing = sb.Filter.data.find(i => (
			i.Type === type
			&& i.Channel === options.Channel
			&& i.Command === options.Command
			&& i.Invocation === options.Invocation
			&& i.User_Alias === options.User_Alias
		));

		if (existing) {
			if (existing.Issued_By !== context.user.ID && !isAdmin) {
				return {
					success: false,
					reply: "This ban has not been created by you, so you cannot modify it!"
				};
			}
			else if (type === "Arguments") {
				const { clear = false, index, string } = context.params;
				if (invocation === "ban") {
					if (!existing.Active) {
						await existing.toggle();
					}

					for (const item of existing.Data.args) {
						if (item.index === index && item.string === string) {
							return {
								success: false,
								reply: `This combination of index and string in an Arguments filter is already banned!`
							};
						}
					}

					if (sb.Utils.isValidInteger(index) && typeof string === "string") {
						existing.Data.args.push({ index, string });

						await existing.saveProperty("Data");
						return {
							reply: `Successfully added a new item to Arguments filter (ID ${existing.ID})`
						};
					}

					return {
						success: false,
						reply: `Invalid combination of parameters for the Argument type provided!`
					};
				}
				else if (invocation === "unban") {
					if (sb.Utils.isValidInteger(index) && typeof string === "string") {
						for (let i = 0; i < existing.Data.args.length; i++) {
							const item = existing.Data.args[i];
							if (item.index === index && item.string === string) {
								existing.Data.args.splice(i, 1);
								await existing.saveProperty("Data");

								return {
									reply: `Successfully removed an item from the Arguments filter (ID ${existing.ID})`
								};
							}
						}

						return {
							success: false,
							reply: `No matching items found in the Arguments filter!`
						};
					}
					else if (clear) {
						existing.Data.args = [];
						await existing.saveProperty("Data");

						return {
							reply: `Successfully cleared all items from the Arguments filter (ID ${existing.ID})`
						};
					}
					else if (existing.Active) {
						await existing.toggle();
						return {
							reply: `Successfully disabled Arguments filter (ID ${existing.ID}). Its items are still available, it just isn't active.`
						};
					}

					return {
						success: false,
						reply: `Invalid combination of parameters for the Argument type provided!`
					};
				}
			}
			else if (type === "Cooldown") {
				const { multiplier } = context.params;
				if (invocation === "ban") {
					if (!existing.Active) {
						await existing.toggle();
					}

					if (typeof multiplier !== "number") {
						return {
							success: false,
							reply: `No multiplier provided! Use multiplier:(number) to set it.`
						};
					}
					else if (multiplier < 1.0 || multiplier >= 1e6) {
						return {
							success: false,
							reply: `Invalid multiplier provided! Must be in range between <1, 1 000 000>.`
						};
					}

					existing.Data = { multiplier };
					await existing.saveProperty("Data");

					return {
						reply: `Successfully updated the cooldown filter!`
					};
				}
				else if (invocation === "unban") {
					await existing.toggle();
					return {
						reply: `Successfully disabled Cooldown filter (ID ${existing.ID}).`
					};
				}
			}
			else if ((existing.Active && invocation === "ban") || (!existing.Active && invocation === "unban")) {
				return {
					success: false,
					reply: `That combination is already ${invocation}ned!`
				};
			}
			else {
				await existing.toggle();

				const [prefix, suffix] = (existing.Active) ? ["", " again"] : ["un", ""];
				return {
					reply: `Successfully ${prefix}banned${suffix}.`
				};
			}
		}
		else {
			if (invocation === "unban") {
				return {
					success: false,
					reply: "This combination has not been banned yet, so it cannot be unbanned!"
				};
			}

			if (type === "Arguments") {
				const { index, string } = context.params;
				if (sb.Utils.isValidInteger(index) && typeof string === "string") {
					options.Data = JSON.stringify({
						args: [{ index, string }]
					});
				}
				else {
					return {
						success: false,
						reply: `Invalid combination of parameters for the Argument type! "index" and "string" must be provided.`
					};
				}
			}
			else if (type === "Cooldown") {
				const { multiplier } = context.params;
				if (typeof multiplier !== "number") {
					return {
						success: false,
						reply: `No multiplier provided! Use multiplier:(number) to set it.`
					};
				}
				else if (multiplier < 1.0 || multiplier >= 1e6) {
					return {
						success: false,
						reply: `Invalid multiplier provided! Must be in range between <1, 1 000 000>.`
					};
				}

				options.Data = JSON.stringify({ multiplier });
			}

			const ban = await sb.Filter.create(options);
			return {
				reply: `Successfully banned (ID ${ban.ID})`
			};
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { availableTypes } = values.getStaticData();

		return [
			"Bans or unbans any combination of user/channel/command.",
			"Only usable by admins or Twitch channel owners. Channel owners can only ban combinations in their channel.",
			"All following examples assume the command is executed by a channel owner.",
			"",

			`Available types: <code>${availableTypes.join(" ")}</code>`,
			`You can change the type. The default type is <code>Blacklist</code>.`,
			"",

			`<code>${prefix}ban user:test command:remind</code>`,
			`<code>${prefix}ban user:test command:remind type:blacklist</code>`,
			"Bans user <u>test</u> from executing the command <u>remind</u> in the current channel.",
			"",

			`<code>${prefix}ban command:remind</code>`,
			"Bans <u>everyone</u> from executing the command <u>remind</u> in the current channel.",
			"",

			`<code>${prefix}ban invocation:rq</code>`,
			"Bans <u>everyone</u> from executing the command invocation <u>rq</u> (but! not rl, or randomline) in the current channel.",
			"",

			`<code>${prefix}ban user:test</code>`,
			"Bans user <u>test</u> from executing <u>any</u> commands in the current channel.",
			"",

			`<code>${prefix}ban type:offline-only (...)</code>`,
			"For any previously mentioned combination, the combination will only be available when the channel is offline.",
			"You can still specify any combination of invocation/command/user/channel to be more or less specific.",
			"",

			`<code>${prefix}ban type:online-only (...)</code>`,
			"Just like <code>offline-only</code>, but reverse - result will be available only in online channels.",
			"",

			`<code>${prefix}ban type:cooldown multiplier:(number) (...)</code>`,
			"Creates a cooldown modifiying filter - will multiply the original cooldown of any provided combination of command/user/channel by a constant.",
			"The number provided must always be above 1.0 - as to not go below the intended cooldowns.",
			"",

			`<code>${prefix}ban type:reminder-prevention user:(user)</code>`,
			`<code>${prefix}ban type:reminder-prevention user:(user) channel:(channel)</code>`,
			"Reminders created by provided user will no longer fire in the specified channel.",
			"The reminders will still exist, they will simply not trigger.",
			"",

			`<code>${prefix}ban type:arguments index:(number) string:(text)</code>`,
			"Disables the use of a specific argument position for given text.",
			`If you use <code>${prefix}ban type:arguments</code> again with the same combination of channel/command/user, then the arguments will stack. To remove or disable, see the help for <code>${prefix}unban type:arguments</code> below.`,
			`Example: <code>${prefix}ban type:arguments command:rm index:0 string:livestreamfail</code> will ban the use of <code>${prefix}rm livestreamfail</code>. This is because the first argument (index 0) is the subreddit name and it matches the text exactly.`,
			`Example: <code>${prefix}ban type:arguments command:remind index:1 string:hello</code> will ban the use of <code>${prefix}remind (anyone) hello</code>. This is because "hello" is the second argument (index 1) and it matches.`,
			"",

			"---",
			"",

			`<code>${prefix}unban (...)</code>`,
			`<code>${prefix}unban type:blacklist (...)</code>`,
			`<code>${prefix}unban type:cooldown (...)</code>`,
			`<code>${prefix}unban type:offline-only (...)</code>`,
			`<code>${prefix}unban type:online-only (...)</code>`,
			"Unbans any previously mentioned combination.",
			"Make sure to use the correct type - <code>Blacklist</code> is again default.",
			"",

			`<code>${prefix}unban type:arguments index:(number) string:(string) (...)</code>`,
			`Removes a single item from a previously added Arguments-type filter - if it exists.`,
			"",

			`<code>${prefix}unban type:arguments (...)</code>`,
			`Disables the Arguments-type filter, leaving its items intact. You can re-enable it by simply using <code>${prefix}ban</code> with the same channel/command/user combination.`,
			"",

			`<code>${prefix}unban type:arguments clear:true (...)</code>`,
			`Instead of disabling the Arguments filter, this will remove all of its items.`,
			""
		];
	})
};
