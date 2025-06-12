import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

import {
	isArgumentsData,
	type CreateData as FilterCreateData,
	type DbArgumentDescriptor,
	type Type as FilterType
} from "../../classes/filter.js";

import type { Channel } from "../../classes/channel.js";
import type { User } from "../../classes/user.js";

const AVAILABLE_BAN_FILTER_TYPES: string[] = [
	"Arguments",
	"Blacklist",
	"Cooldown",
	"Online-only",
	"Offline-only",
	"Reminder-prevention"
] as const;
const NO_RESPONSE_FILTER_TYPES: Set<FilterType> = new Set([
	"Arguments",
	"Blacklist",
	"Online-only",
	"Offline-only"
]);

const isFilterType = (input: string): input is FilterType => AVAILABLE_BAN_FILTER_TYPES.includes(input);

export default declare({
	Name: "ban",
	Aliases: ["unban"],
	Cooldown: 5000,
	Description: "Bans/unbans any combination of channel, user, and command from being executed. Only usable by channel owners and Supibot ambassadors.",
	Flags: ["mention"],
	Params: [
		{ name: "all", type: "boolean" },
		{ name: "channel", type: "string" },
		{ name: "clear", type: "boolean" },
		{ name: "command", type: "string" },
		{ name: "index", type: "number" },
		{ name: "invocation", type: "string" },
		{ name: "multiplier", type: "number" },
		{ name: "noResponse", type: "boolean" },
		{ name: "type", type: "string" },
		{ name: "string", type: "string" },
		{ name: "user", type: "string" }
	] as const,
	Whitelist_Response: null,
	Code: (async function ban (context) {
		const { invocation } = context;
		const type = core.Utils.capitalize(context.params.type ?? "Blacklist");
		if (!isFilterType(type)) {
			return {
				success: false,
				reply: `Invalid ban filter type provided! Use one of ${AVAILABLE_BAN_FILTER_TYPES.join(", ")}`
			};
		}

		const options: FilterCreateData = {
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
				const emote = await context.randomEmote("PepeLaugh", "pepeLaugh", "4Head", "😅");
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
				const emote = await context.randomEmote("PepeLaugh", "pepeLaugh", "4Head", "😅");
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
			if (!context.channel) {
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
				if (context.params.noResponse) {
					if (!options.Channel) {
						return {
							success: false,
							reply: "Cannot create a user-specific ban with no response!"
						};
					}
					else if (!NO_RESPONSE_FILTER_TYPES.has(type)) {
						return {
							success: false,
							reply: `Cannot create a no-response ban of type ${type}!`
						};
					}

					options.Response = "None";
					options.Reason = null;
				}
				else {
					options.Response = "Auto";
					options.Reason = null;
				}
			}
		}

		if (!options.User_Alias && !options.Command && !options.Channel && isAdmin) {
			return {
				success: false,
				reply: "Not enough data provided to create a ban! You are missing all identifiers."
			};
		}

		if (type === "Reminder-prevention" && (!options.Channel || !options.User_Alias || options.Command || options.Invocation)) {
			return {
				success: false,
				reply: `You must provide the channel and a user (no other params) to create a reminder prevention!`
			};
		}

		let channelData: Channel | null = null;
		if (options.Channel) {
			channelData = sb.Channel.get(options.Channel);
		}

		let userData: User | null = null;
		if (options.User_Alias) {
			userData = await sb.User.get(options.User_Alias);
		}

		const rawFilterResult = sb.Filter.getLocals(type, {
			channel: channelData,
			user: userData,
			command: options.Command,
			invocation: options.Invocation,
			includeInactive: true
		});

		const filterResult = rawFilterResult.filter(i => (
			(i.Channel === (channelData?.ID ?? null))
			&& (i.User_Alias === (userData?.ID ?? null))
			&& (i.Command === options.Command)
		));

		if (filterResult.length !== 0) {
			const [existing] = filterResult;

			if (existing.Issued_By !== context.user.ID && !isAdmin) {
				return {
					success: false,
					reply: "This ban has not been created by you, so you cannot modify it!"
				};
			}
			else if (type === "Arguments") {
				if (!existing.Data) {
					throw new SupiError({
						message: `Invalid filter definition - missing Data`
					});
				}
				else if (!isArgumentsData(existing.Data)) {
					throw new SupiError({
						message: `Invalid filter definition - invalid Cooldown data`
					});
				}

				const { clear = false, index, string } = context.params;
				if (invocation === "ban") {
					if (!existing.Active) {
						await existing.toggle();
					}

					const newData: DbArgumentDescriptor[] = [...existing.Data];
					for (const item of existing.Data) {
						if (item.index === index && item.string === string) {
							return {
								success: false,
								reply: `This combination of index and string in an Arguments filter is already banned!`
							};
						}
					}

					if (typeof string === "string") {
						let changed = false;
						if (context.params.all === true) {
							changed = true;
							newData.push({ range: [0, Infinity], string });
						}
						else if (core.Utils.isValidInteger(index)) {
							changed = true;
							newData.push({ index, string });
						}

						if (changed) {
							await existing.saveProperty("Data", JSON.stringify(newData));
							return {
								success: true,
								reply: `Successfully added a new item to Arguments filter (ID ${existing.ID})`
							};
						}
					}

					return {
						success: false,
						reply: `Invalid combination of parameters for the Argument type provided!`
					};
				}
				else if (invocation === "unban") {
					if ((core.Utils.isValidInteger(index) || context.params.all === true) && typeof string === "string") {
						for (let i = 0; i < existing.Data.length; i++) {
							const item = existing.Data[i];
							const condition = (context.params.all === true)
								? (item.range && item.range[0] === 0 && item.range[1] === Infinity)
								: (item.index === index);

							if (condition && item.string === string) {
								existing.Data.splice(i, 1);
								await existing.saveProperty("Data");

								return {
									success: true,
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
						await existing.saveProperty("Data", "[]");
						return {
							success: true,
							reply: `Successfully cleared all items from the Arguments filter (ID ${existing.ID})`
						};
					}
					else if (existing.Active) {
						await existing.toggle();
						return {
							success: false,
							reply: `Successfully disabled Arguments filter (ID ${existing.ID}). Its items are still available, it just isn't active.`
						};
					}

					return {
						success: false,
						reply: `Invalid combination of parameters for the Argument type provided!`
					};
				}
				else {
					throw new SupiError({
						message: "Invalid invocation - this should never happen",
						args: { invocation }
					});
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
					else if (multiplier < 1 || multiplier >= 1e6) {
						return {
							success: false,
							reply: `Invalid multiplier provided! Must be in range between <1, 1 000 000>.`
						};
					}

					existing.Data = { multiplier };
					await existing.saveProperty("Data");

					return {
						success: true,
						reply: `Successfully updated the cooldown filter!`
					};
				}
				else if (invocation === "unban") {
					await existing.toggle();
					return {
						success: false,
						reply: `Successfully disabled Cooldown filter (ID ${existing.ID}).`
					};
				}
				else {
					throw new SupiError({
						message: "Invalid invocation - this should never happen",
						args: { invocation }
					});
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
					success: true,
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
				if (core.Utils.isValidInteger(index) && typeof string === "string") {
					options.Data = JSON.stringify({
						args: [{ index, string }]
					});
				}
				else if (context.params.all === true && typeof string === "string") {
					options.Data = JSON.stringify({
						args: [{ range: "0..Infinity", string }]
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
				else if (multiplier < 1 || multiplier >= 1e6) {
					return {
						success: false,
						reply: `Invalid multiplier provided! Must be in range between <1, 1 000 000>.`
					};
				}

				options.Data = JSON.stringify({ multiplier });
			}

			const ban = await sb.Filter.create(options);
			const summary = [
				(options.User_Alias) ? "user-specific" : "",
				(options.Command) ? "command-specific" : "",
				(options.Invocation) ? "invocation-specific" : "",
				(options.Channel) ? "channel-specific" : "global",
				`filter of type ${options.Type}`
			].filter(Boolean).join(", ");

			return {
				success: true,
				reply: `Successfully banned (ID ${ban.ID}). Summary: you created a ${summary}`
			};
		}
	}),
	Dynamic_Description: (function () {
		return [
			"Bans or unbans any combination of user/channel/command.",
			"Only usable by channel owners and Supibot ambassadors, who can only ban combinations specific for their respective channel.",
			"",

			`Available types: <code>${AVAILABLE_BAN_FILTER_TYPES.join(" ")}</code>`,
			`You can change the type. The default type is <code>Blacklist</code>.`,
			"",

			`<code>$ban user:test command:remind</code>`,
			`<code>$ban user:test command:remind type:blacklist</code>`,
			"Bans user <u>test</u> from executing the command <u>remind</u> in the current channel.",
			"",

			`<code>$ban command:remind</code>`,
			"Bans <u>everyone</u> from executing the command <u>remind</u> in the current channel.",
			"",

			`<code>$ban invocation:rq</code>`,
			"Bans <u>everyone</u> from executing the command invocation <u>rq</u> (but! not rl, or randomline) in the current channel.",
			"",

			`<code>$ban user:test</code>`,
			"Bans user <u>test</u> from executing <u>any</u> commands in the current channel.",
			"",

			`<code>$ban <u>noResponse:true</u> (...)</code>`,
			`If the <code>noResponse</code> parameter is set, this will make it so that the bot will not reply in the case this ban is triggered.`,
			"E.g. setting a offline-only ban for a command will make it so when anyone tries use the command while the channel is online, the bot will simply not rpely.",
			"Note: This is not applicable to user-specific bans. In those cases, the user must be reminded that they are indeed banned.",
			"",

			`<code>$ban type:offline-only (...)</code>`,
			"For any previously mentioned combination, the combination will only be available when the channel is offline.",
			"You can still specify any combination of invocation/command/user/channel to be more or less specific.",
			"",

			`<code>$ban type:online-only (...)</code>`,
			"Just like <code>offline-only</code>, but reverse - result will be available only in online channels.",
			"",

			`<code>$ban type:cooldown multiplier:(number) (...)</code>`,
			"Creates a cooldown modifying filter - will multiply the original cooldown of any provided combination of command/user/channel by a constant.",
			"The number provided must always be above 1.0 - as to not go below the intended cooldowns.",
			"",

			`<code>$ban type:reminder-prevention user:(user)</code>`,
			`<code>$ban type:reminder-prevention user:(user) channel:(channel)</code>`,
			"Reminders created by provided user will no longer fire in the specified channel.",
			"The reminders will still exist, they will simply not trigger.",
			"",

			`<code>$ban type:arguments index:(number) string:(text)</code>`,
			`<code>$ban type:arguments all:true string:(text)</code>`,
			"Disables the use of a specific argument position for given text, or any position if <code>all:true</code> is used.",
			`If you use <code>$ban type:arguments</code> again with the same combination of channel/command/user, then the arguments will stack. To remove or disable, see the help for <code>$unban type:arguments</code> below.`,
			`Example: <code>$ban type:arguments command:rm index:0 string:livestreamfail</code> will ban the use of <code>$rm livestreamfail</code>. This is because the first argument (index 0) is the subreddit name and it matches the text exactly.`,
			`Example: <code>$ban type:arguments command:remind index:1 string:hello</code> will ban the use of <code>$remind (anyone) hello</code>. This is because "hello" is the second argument (index 1) and it matches.`,
			"",

			"---",
			"",

			`<code>$unban (...)</code>`,
			`<code>$unban type:blacklist (...)</code>`,
			`<code>$unban type:cooldown (...)</code>`,
			`<code>$unban type:offline-only (...)</code>`,
			`<code>$unban type:online-only (...)</code>`,
			"Unbans any previously mentioned combination.",
			"Make sure to use the correct type - <code>Blacklist</code> is again default.",
			"",

			`<code>$unban type:arguments index:(number) string:(string) (...)</code>`,
			`Removes a single item from a previously added Arguments-type filter - if it exists.`,
			"",

			`<code>$unban type:arguments (...)</code>`,
			`Disables the Arguments-type filter, leaving its items intact. You can re-enable it by simply using <code>$ban</code> with the same channel/command/user combination.`,
			"",

			`<code>$unban type:arguments clear:true (...)</code>`,
			`Instead of disabling the Arguments filter, this will remove all of its items.`,
			""
		];
	})
});
