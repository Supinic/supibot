module.exports = {
	Name: "set",
	Aliases: ["unset"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sets/unsets certain variables within Supibot. Check the extended help for full info.",
	Flags: ["mention","owner-override"],
	Whitelist_Response: null,
	Static_Data: (() => {
		const birthdayRegex = /(\d+)[.\-/\s]+(\w{3})/i;
		const birthdayFormatter = new Intl.DateTimeFormat("en-us", {
			day: "numeric",
			month: "long"
		});
	
		const availableFlags = ["anime", "animal", "disfigured", "disturbing", "drawn", "furry", "gore", "hentai", "human", "language", "none", "porn", "scat", "softcore"];
		const handleAmbassadors = async (type, context, ...args) => {
			const [user, channel = context.channel?.Name] = args;
			if (!user || !channel) {
				return {
					success: false,
					reply: `Must provide a proper user and channel!`
				};
			}
	
			const userData = await sb.User.get(user);
			const channelData = sb.Channel.get(channel, context.platform);
			if (!userData || !channelData) {
				return {
					success: false,
					reply: `Either the channel or the user have not been found!`
				};
			}
			else if (type === "set" && userData.Name === channelData.Name) {
				return {
					success: false,
					reply: "Channel owners can't be set as their own channel's ambassadors!"
				};
			}
	
			const isAmbassador = channelData.isUserAmbassador(userData);
			if ((type === "set" && isAmbassador) || (type === "unset" && !isAmbassador)) {
				const prefix = (type === "set") ? "already" : "not";
				return {
					success: false,
					reply: `Cannot ${context.invocation} ${userData.Name} as an ambassador in ${channelData.Name}, because they are ${prefix} one!`
				};
			}
	
			await channelData.toggleAmbassador(userData);
	
			if (type === "set") {
				const message = sb.Utils.tag.trim `
					You are now a Supibot Ambassador in the channel ${channelData.Name}!
					This means you can use some commands as if you were the channel owner, such as "ban" - check its help!
					You should also notify @Supinic whenever there's an issue, or something needs to be fixed or done regarding the bot.
					Have fun and stay responsible 🙂
				`;
	
				try {
					await context.platform.pm(message, userData.Name);
				}
				catch {
					const selfBotUserData = await sb.User.get(context.platform.Self_Name);
					await sb.Reminder.create({
						User_From: selfBotUserData.ID,
						User_To: userData.ID,
						Platform: context.platform.ID,
						Channel: context.channel.ID,
						Created: new sb.Date(),
						Active: true,
						Schedule: null,
						Text: message,
						Private_Message: false
					}, true);
				}
			}
	
			const string = (type === "set") ? "now" : "no longer";
			return {
				reply: `${userData.Name} is ${string} a Supibot Ambassador in #${channelData.Name}.`
			};
		};
	
		return {
			availableFlags,
			variables: [
				{
					names: "ambassador",
					aliases: [],
					adminOnly: true,
					parameter: "arguments",
					description: `Designates a user as an "Ambassador" in a specific channel, which grants them elevated access to some Supibot commands.`,
					set: (context, ...args) => handleAmbassadors("set", context, ...args),
					unset: (context, ...args) => handleAmbassadors("unset", context, ...args)
				},
				{
					names: "reminder",
					aliases: ["notify", "reminders", "notification", "notifications"],
					parameter: "ID",
					description: "Unsets an active reminder either set by you, or for you.",
					getLastID: (context) => sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("chat_data", "Reminder")
						.where("User_From = %n", context.user.ID)
						.where("Active = %b", true)
						.orderBy("ID DESC")
						.limit(1)
						.single()
						.flat("ID")
					),
					unset: async (context, ID) => {
						const row = await sb.Query.getRow("chat_data", "Reminder");
						try {
							await row.load(ID);
						}
						catch {
							return {
								success: false,
								reply: "ID does not exist!"
							};
						}
	
						if (row.values.User_From !== context.user.ID && row.values.User_To !== context.user.ID ) {
							return {
								success: false,
								reply: "That reminder was not created by you or set for you!"
							};
						}
						else if (!row.values.Active) {
							return {
								success: false,
								reply: "That reminder is already deactivated!"
							};
						}
						else if (context.channel?.ID && !row.values.Schedule && row.values.User_To === context.user.ID) {
							return {
								success: false,
								reply: "Good job, trying to unset a reminder that just fired PepeLaugh"
							};
						}
						else {
							const reminder = sb.Reminder.get(ID);
							if (reminder) {
								await reminder.deactivate(true);
							}
							else {
								row.values.Active = false;
								await row.save();
							}
	
							return {
								reply: `Reminder ID ${ID} unset successfully.`
							};
						}
					}
				},
				{
					names: "suggestion",
					aliases: ["suggest", "suggestions"],
					parameter: "ID",
					description: "Marks an active suggestion created by you to be \"Dismissed by author\", therefore removing it from the list of active suggestions.",
					getLastID: (context) => sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("data", "Suggestion")
						.where("User_Alias = %n", context.user.ID)
						.orderBy("ID DESC")
						.limit(1)
						.single()
						.flat("ID")
					),
					unset: async (context, ID, ...args) => {
						const row = await sb.Query.getRow("data", "Suggestion");
						try {
							await row.load(ID);
						}
						catch {
							return { reply: "ID does not exist!" };
						}
	
						if (row.values.User_Alias !== context.user.ID) {
							return {
								success: false,
								reply: "That suggestion was not created by you!"
							};
						}
						else if (row.values.Status === "New" || row.values.Status === "Needs testing") {
							if (row.values.Status === "New") {
								row.values.Status = "Dismissed by author";
								row.values.Priority = null;
							}
							else if (row.values.Status === "Needs testing") {
								row.values.Status = "Completed";
								if (args.length > 0) {
									row.values.Notes = `Testing updated by author: ${args.join(" ")}\n\n${row.values.Notes}`;
								}
							}
	
							await row.save();
	
							return {
								reply: `Suggestion ID ${ID} has been set as "${row.values.Status}".`
							};
						}
						else {
							return {
								success: false,
								reply: "You cannot unset a suggestion if it's already been processed!"
							};
						}
					}
				},
				{
					names: "location",
					aliases: [],
					parameter: "arguments",
					description: `Sets/unsets your IRL location. If you add the keyword "private", it's going to be hidden. This location is used in commands such as weather, time, and others.`,
					set: async (context, ...args) => {
						let hidden = false;
						let visibilityType = null;
						if (args[0] === "private" || args[0] === "hidden") {
							hidden = true;
							visibilityType = args.shift();
						}
						else if (args[0] === "public" || args[0] === "visible") {
							hidden = false;
							visibilityType = args.shift();
						}
	
						if (args.length === 0) {
							const { location } = context.user.Data;
							if (location && visibilityType !== null) {
								if (location.hidden === hidden) {
									return {
										success: false,
										reply: `Your location is already ${visibilityType}!`
									};
								}
								else {
									location.hidden = hidden;
									await context.user.saveProperty("Data", context.user.Data);
									return {
										reply: `Your location is now ${visibilityType}!`
									};
								}
							}
							else {
								return {
									success: false,
									reply: "No location provided!",
									cooldown: 2500
								};
							}
						}
	
						const query = args.join(" ");
						const { components, coordinates, formatted, location, placeID, success } = await sb.Utils.fetchGeoLocationData(
							sb.Config.get("API_GOOGLE_GEOCODING"),
							query
						);
	
						if (!success) {
							return {
								success: false,
								reply: "No location found for given query!"
							};
						}
	
						context.user.Data.location = {
							formatted,
							placeID,
							components,
							hidden,
							coordinates: coordinates ?? location,
							original: query
						};
	
						await context.user.saveProperty("Data", context.user.Data);
						return {
							reply: `Successfully set your ${hidden ? "private" : "public"} location!`
						};
					},
					unset: async (context) => {
						if (!context.user.Data.location) {
							return {
								success: false,
								reply: `You don't have a location set up, so there is nothing to unset!`
							};
						}
	
						context.user.Data.location = null;
	
						await context.user.saveProperty("Data", context.user.Data);
						return {
							reply: "Your location has been unset successfully!"
						};
					}
				},
				{
					names: "gc",
					aliases: [],
					parameter: "ID",
					description: "If you made a mistake with the gc command, you can use this to remove a track from the todo list.",
					unset: async (context, ID) => {
						const row = await sb.Query.getRow("music", "Track");
						try {
							await row.load(ID);
						}
						catch {
							return {
								success: false,
								reply: "ID does not exist!"
							};
						}
	
						if (!context.user.Data.administrator && row.values.Added_By !== context.user.ID) {
							return {
								success: false,
								reply: "This track was not added by you!"
							};
						}
	
						const tags = await sb.Query.getRecordset(rs => rs
							.select("Tag")
							.from("music", "Track_Tag")
							.where("Track = %n", ID)
							.flat("Tag")
						);
	
						// If gachi tag is present already, there is no reason to unset it.
						if (tags.includes(6)) {
							return {
								success: false,
								reply: "This track has already been categorized, and cannot be changed like this!"
							};
						}
	
						// Deletes TODO tag of given track.
						await sb.Query.raw(`DELETE FROM music.Track_Tag WHERE (Track = ${ID} AND Tag = 20)`);
	
						return {
							reply: `Track ID ${ID} (${row.values.Name}) has been stripped of the TODO tag.`
						};
					}
				},
				{
					names: "discord",
					aliases: [],
					elevatedChannelAccess: true,
					parameter: "arguments",
					description: "If you're the channel owner or a channel ambassador, you can use this to set the response of the discord command.",
					set: async (context, ...args) => {
						context.channel.Data.discord = args.join(" ");
						await context.channel.saveProperty("Data");
	
						return {
							reply: `Discord description set successfully.`
						};
					},
					unset: async (context) => {
						context.channel.Data.discord = null;
						await context.channel.saveProperty("Data");
	
						return {
							reply: `Discord description unset successfully.`
						};
					}
				},
				{
					names: "birthday",
					aliases: ["bday"],
					parameter: "arguments",
					description: "Lets you set your birthday (only day and month!) for use in other commands, like $horoscope.",
					set: async (context, ...args) => {
						const query = args.join(" ");
						if (!query) {
							return {
								success: false,
								reply: "No date provided!"
							};
						}
						else if (!birthdayRegex.test(query)) {
							return {
								success: false,
								reply: `The date you provided must be in form "day-month", where month is specified by 3 characters, e.g. "Jan" or "Aug"`
							};
						}
	
						const date = new sb.Date(query);
						if (!date.valueOf()) {
							return {
								success: false,
								reply: "Date could not be parsed :("
							};
						}
	
						context.user.Data.birthday = {
							month: date.month,
							day: date.day,
							string: birthdayFormatter.format(date)
						};
						await context.user.saveProperty("Data", context.user.Data);
	
						return {
							reply: `Successfully set your birthday to ${context.user.Data.birthday.string}.`
						};
					},
					unset: async (context) => {
						if (!context.user.Data.birthday) {
							return {
								success: false,
								reply: `You don't have a birthday date set up, so there is nothing to unset!`
							};
						}
	
						context.user.Data.birthday = null;
						await context.user.saveProperty("Data", context.user.Data);
	
						return {
							reply: "Your birthday date has been unset successfully!"
						};
					}
				},
				{
					names: "twitchlotto",
					aliases: ["tl"],
					parameter: "arguments",
					description: `If you have been nominated as a TwitchLotto-trusted user, you can then set flags to TL links. Available flags: <code>${availableFlags.join(", ")}</code>`,
					set: async (context, link, ...flags) => {
						if (!context.user.Data.trustedTwitchLottoFlagger) {			
							return {
								success: false,
								reply: `You don't have access to flag TwitchLotto images!`
							};
						}
						else if (!link) {
							return {
								success: false,
								reply: `No link provided!`
							};
						}

						flags = flags.filter(i => availableFlags.includes(i.toLowerCase()));
						if (flags.length === 0) {
							return {
								success: false,
								reply: `No suitable flags provided!`
							};
						}
	
						const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,7}\.\w{3})/;
						const match = link.match(regex);
						if (!match) {
							return {
								success: false,
								reply: `Invalid link format!`
							};
						}
	
						const exists = await sb.Query.getRecordset(rs => rs
						    .select("Link")
						    .from("data", "Twitch_Lotto")
							.where("Link = %s", match[4])
							.limit(1)
							.single()
							.flat("Link")
						);
						if (!exists) {
							return {
								success: false,
								reply: `Link does not exist in the TwitchLotto database!`
							};
						}
	
						await sb.Query.getRecordUpdater(ru => ru
							.update("data", "Twitch_Lotto")
							.set("Adult_Flags", flags.sort())
							.where("Link = %s", match[4])
						);
	
						return {
							reply: `Link ${link} successfully updated with flags ${flags.sort().join(", ")}.`
						};
					}
				},
				{
					names: "tlbl",
					aliases: ["twitchlottoblacklist"],
					parameter: "arguments",
					description: `If you are the channel ambassador/owner, you can decide what flags should be blacklisted. Each usage removes the previous ones, so always use a full list.`,
					set: async (context, ...flags) => {
						if (!context.channel) {
							return {
								success: false,
								reply: "You cannot use the command here!"
							};
						}

						// const flagger = Boolean(context.user.Data.trustedTwitchLottoFlagger); // skipped for now
						const ambassador = context.channel.isUserAmbassador(context.user);
						const owner = context.channel.isUserChannelOwner(context.user);
						if (!ambassador && !owner) {
							return {
								success: false,
								reply: `You cannot do that here!`
							};
						}
						else if (flags.length === 0) {
							return {
								success: false,
								reply: `If you want to remove all flags, use $unset instead!`
							};
						}

						const suitableFlags = flags.filter(i => availableFlags.includes(i.toLowerCase()));
						if (suitableFlags.length === 0) {
							return {
								success: false,
								reply: `No suitable flags provided!`
							};
						}

						context.channel.Data.twitchLottoBlacklistedFlags = suitableFlags.map(i => i.toLowerCase());
						await context.channel.saveProperty("Data");

						return {
							reply: `Blacklisted flags successfully updated for this channel.`
						};
					},
					unset: async (context) => {
						if (!context.channel) {
							return {
								success: false,
								reply: "You cannot use the command here!"
							};
						}

						// const flagger = Boolean(context.user.Data.trustedTwitchLottoFlagger); // skipped for now
						const ambassador = context.channel.isUserAmbassador(context.user);
						const owner = context.channel.isUserChannelOwner(context.user);
						if (!ambassador && !owner) {
							return {
								success: false,
								reply: `You cannot do that here!`
							};
						}

						context.channel.Data.twitchLottoBlacklistedFlags = [];
						await context.channel.saveProperty("Data");

						return {
							reply: `Blacklisted flags successfully removed.`
						};
					}
				}
			]
		};
	}),
	Code: (async function set (context, type, ...args) {
		if (!type) {
			return {
				success: false,
				reply: "No type provided!"
			};
		}
	
		const { invocation } = context;
		type = type.toLowerCase();
	
		const target = this.staticData.variables.find(i => type === i.name || i.aliases.includes(type));
		if (!target) {
			return {
				success: false,
				reply: "Invalid type provided!"
			};
		}
		else if (typeof target[invocation] !== "function") {
			return {
				success: false,
				reply: `You cannot ${invocation} the type ${type}!`
			};
		}
	
		if (target.adminOnly && !context.user.Data.administrator) {
			return {
				success: false,
				reply: `Only administrators can work with the type "${type}"!`
			};
		}
		else if (
			target.elevatedChannelAccess
			&& !context.channel.isUserChannelOwner(context.user)
			&& !context.channel.isUserAmbassador(context.user)
		) {
			return {
				success: false,
				reply: `Only channel owners and ambassadors can work with the type "${type}"!`
			};
		}
	
		if (target.parameter === "arguments") {
			return await target[invocation](context, ...args);
		}
		else if (target.parameter === "ID") {
			if (args.length === 0) {
				return {
					success: false,
					reply: "At least one item must be provided!"
				};
			}

			let IDs = args.map(i => Number(i)).filter(Boolean);
			if (args[0] === "last") {
				if (typeof target.getLastID !== "function") {
					return {
						success: false,
						reply: `You cannot use the keyword "last" while ${invocation}ting a ${type}!`
					};
				}

				const lastID = await target.getLastID(context);
				if (typeof lastID !== "number") {
					return {
						success: false,
						reply: `You don't have any active ${type}s to be ${invocation}!`
					};
				}

				IDs = [lastID];
			}

			if (IDs.length > 1 && invocation === "set") {
				return {
					success: false,
					reply: "Cannot set more than one item at a time!"
				};
			}

			const results = [];
			for (const ID of IDs) {
				if (!sb.Utils.isValidInteger(ID)) {
					results.push({
						ID,
						success: false,
						reply: `Provided ID is not a valid number!`
					});

					continue;
				}

				const subResult = await target[invocation](context, ID);
				results.push({ ID, ...subResult });
			}

			if (results.length === 1) {
				return {
					success: results[0].success,
					reply: results[0].reply
				};
			}
			else {
				const [success, fail] = sb.Utils.splitByCondition(results, i => (i.success !== false));
				const successString = (success.length > 0)
					? `Success: ${invocation}ting IDs ${success.map(i => i.ID).join(", ")}.`
					: "";
				const failString = (fail.length > 0)
					? `Fail: ${invocation}ting IDs ${fail.map(i => i.ID).join(", ")}.`
					: "";

				return {
					reply: [successString, failString].filter(Boolean).join(" ")
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { variables } = values.getStaticData();
		const list = variables.map(i => {
			let names = i.name;
			if (i.aliases.length > 0) {
				names += `(${i.aliases.join(", ")})`;
			}
	
			const types = [
				(i.set) ? "set" : "",
				(i.unset) ? "unset" : ""
			].filter(Boolean).join("/");
			
			return `<li><code>${names}</code> (${types}) ${i.description}</li>`;
		}).join("");
	
		return [
			"Sets a variable that you can then use in Supibot's commands.",
			"",
	
			`<code>${prefix}set (variable) (data)</code>`,
			`Sets the variable of the given type with given data.`,
			"",
			
			"List of variables:",
			`<ul>${list}</ul>`		
		];	
	})
};