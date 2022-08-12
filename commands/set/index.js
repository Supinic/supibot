module.exports = {
	Name: "set",
	Aliases: ["unset"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sets/unsets certain variables within Supibot. Check the extended help for full info.",
	Flags: ["mention","owner-override"],
	Params: [
		{ name: "from", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		const timersLimit = 5;
		const timerNameRegex = /^[-\w\u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff]{2,25}$/;

		let availableFlags = [];
		let createRecentTwitchLottoCacheKey;
		try {
			const definitions = require("../twitchlotto/definitions.js");

			availableFlags = definitions.flags.map(i => i.toLowerCase());
			createRecentTwitchLottoCacheKey = definitions.createRecentUseCacheKey;
		}
		catch {
			availableFlags = [];
			createRecentTwitchLottoCacheKey = null;
		}

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

			const isAmbassador = await channelData.isUserAmbassador(userData);
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

		const setInstagramFlags = async (context, flag) => {
			const { channel } = context;
			if (!channel) {
				return {
					success: false,
					reply: "You can't set any settings without being in a channel!"
				};
			}

			const permissions = await context.getUserPermissions();
			if (permissions.flag === sb.User.permissions.regular) {
				return {
					success: false,
					reply: "You don't have access to this channel's settings! Only administrators, channel owners and ambassadors can."
				};
			}

			const string = (flag) ? "set" : "unset";
			const currentFlag = await context.channel.getDataProperty("instagramNSFW");
			if ((typeof currentFlag === "undefined" && !flag) || currentFlag === flag) {
				return {
					success: false,
					reply: `This channel's Instagram NSFW flag is already ${string}!`
				};
			}

			await context.channel.setDataProperty("instagramNSFW", flag);
			return {
				reply: `Successfully ${string} this channel's Instagram NSFW.`
			};
		};

		const fetchTrackIDs = async (tracks) => {
			const stringIDs = tracks.map(i => {
				const type = sb.Utils.modules.linkParser.autoRecognize(i);
				if (!type) {
					return null;
				}

				return sb.Utils.modules.linkParser.parseLink(i);
			}).filter(Boolean);

			if (stringIDs.length === 0) {
				return [];
			}

			return await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("music", "Track")
				.where("Link IN %s+", stringIDs)
				.flat("ID")
			);
		};

		const updateTrackFavouriteStatus = async (context, IDs, status) => {
			for (const ID of IDs) {
				const row = await sb.Query.getRow("music", "Track");
				await row.load({ User_Alias: context.user.ID, Track: ID }, true);
				if (!row.loaded) {
					row.setValues({
						User_Alias: context.user.ID,
						Track: ID
					});
				}

				row.values.Active = status;
				await row.save({ skipLoad: true });
			}
		};

		return {
			availableFlags,
			variables: [
				{
					name: "ambassador",
					aliases: [],
					adminOnly: true,
					parameter: "arguments",
					description: `Designates a user as an "Ambassador" in a specific channel, which grants them elevated access to some Supibot commands.`,
					set: (context, ...args) => handleAmbassadors("set", context, ...args),
					unset: (context, ...args) => handleAmbassadors("unset", context, ...args)
				},
				{
					name: "reminder",
					aliases: ["notify", "reminders", "notification", "notifications"],
					parameter: "ID",
					description: "Unsets an active reminder either set by you, or for you. You can use the <code>from:(user)</code> parameter to quickly unset all timed reminders set for you by a given user.",
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
					set: () => ({
						success: false,
						reply: `Use the ${sb.Command.prefix}remind command instead!`
					}),
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

						if (row.values.User_From !== context.user.ID && row.values.User_To !== context.user.ID) {
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
								await reminder.deactivate(true, true);
							}
							else {
								row.values.Active = false;
								await row.save();
							}

							return {
								reply: `Reminder ID ${ID} unset successfully.`
							};
						}
					},
					userSpecificUnset: async (context) => {
						const authorUserData = await sb.User.get(context.params.from);
						if (!authorUserData) {
							return {
								success: false,
								reply: `No such user exists!`
							};
						}

						const reminderIDs = await sb.Query.getRecordset(rs => rs
							.select("ID")
							.from("chat_data", "Reminder")
							.where("Active = %b", true)
							.where("Schedule IS NOT NULL")
							.where("User_From = %n", authorUserData.ID)
							.where("User_To = %n", context.user.ID)
							.flat("ID")
						);

						if (reminderIDs.length === 0) {
							return {
								success: false,
								reply: `You have no active timed reminders pending from that user!`
							};
						}

						const promises = [];
						for (const reminderID of reminderIDs) {
							const reminder = sb.Reminder.get(reminderID);
							if (!reminder) {
								continue;
							}

							promises.push(reminder.deactivate(true, true));
						}

						await Promise.all(promises);
						return {
							reply: `Successfully unset ${promises.length} timed reminders from that user.`
						};
					}
				},
				{
					name: "suggestion",
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
					set: () => ({
						success: false,
						reply: `Use the ${sb.Command.prefix}suggest command instead!`
					}),
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
						else if (!row.values.Status || row.values.Status === "New" || row.values.Status === "Needs testing") {
							if (!row.values.Status || row.values.Status === "New") {
								row.values.Status = "Dismissed by author";
								row.values.Priority = null;
							}
							else if (row.values.Status === "Needs testing") {
								row.values.Status = "Completed";
								if (args.length > 0) {
									row.values.Notes = `Testing updated by author: ${args.join(" ")}\n\n${row.values.Notes}`;
								}
							}

							if (!row.values.Category) {
								row.values.Category = "Void";
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
					name: "location",
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
							const location = await context.user.getDataProperty("location");
							if (location && visibilityType !== null) {
								if (location.hidden === hidden) {
									return {
										success: false,
										reply: `Your location is already ${visibilityType}!`
									};
								}
								else {
									location.hidden = hidden;
									await context.user.setDataProperty("location", location);
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

						await context.user.setDataProperty("location", {
							formatted,
							placeID,
							components,
							hidden,
							coordinates: coordinates ?? location,
							original: query
						});

						return {
							reply: `Successfully set your ${hidden ? "private" : "public"} location!`
						};
					},
					unset: async (context) => {
						const location = await context.user.getDataProperty("location");
						if (!location) {
							return {
								success: false,
								reply: `You don't have a location set up, so there is nothing to unset!`
							};
						}

						await context.user.setDataProperty("location", null);
						return {
							reply: "Your location has been unset successfully!"
						};
					}
				},
				{
					name: "gc",
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

						const permissions = await context.getUserPermissions();
						if (!permissions.is("administrator") && row.values.Added_By !== context.user.ID) {
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
					name: "discord",
					aliases: [],
					elevatedChannelAccess: true,
					parameter: "arguments",
					description: "If you're the channel owner or a channel ambassador, you can use this to set the response of the discord command.",
					set: async (context, ...args) => {
						await context.channel.setDataProperty("discord", args.join(" "));
						return {
							reply: `Discord description set successfully.`
						};
					},
					unset: async (context) => {
						await context.channel.setDataProperty("discord", null);
						return {
							reply: `Discord description unset successfully.`
						};
					}
				},
				{
					name: "birthday",
					aliases: ["bday"],
					parameter: "arguments",
					description: "Lets you set your birthday (only day and month!) for use in other commands, like $horoscope. Use the MM-DD format (05-01 for May 1st), or \"may 1\", or \"1 may\".",
					set: async (context, ...args) => {
						const query = args.join(" ");
						if (!query) {
							return {
								success: false,
								reply: "No date provided!"
							};
						}

						const date = new sb.Date(query);
						if (Number.isNaN(date.valueOf())) {
							return {
								success: false,
								reply: "Date could not be parsed! Use the MM-DD format (e.g.: 05-01 for May 1st) if in doubt."
							};
						}

						const birthdayString = date.format("F jS");
						await context.user.setDataProperty("birthday", {
							month: date.month,
							day: date.day,
							string: birthdayString
						});

						return {
							reply: `Successfully set your birthday to ${birthdayString}.`
						};
					},
					unset: async (context) => {
						const birthdayData = await context.user.getDataProperty("birthday");
						if (!birthdayData) {
							return {
								success: false,
								reply: `You don't have a birthday date set up, so there is nothing to unset!`
							};
						}

						await context.user.setDataProperty("birthday", null);
						return {
							reply: "Your birthday date has been unset successfully!"
						};
					}
				},
				{
					name: "twitchlotto",
					aliases: ["tl"],
					parameter: "arguments",
					description: `If you have been nominated as a TwitchLotto-trusted user, you can then set flags to TL links. Available flags: <code>${availableFlags.join(", ")}</code>`,
					set: async (context, link, ...flags) => {
						const hasAccess = await context.user.getDataProperty("trustedTwitchLottoFlagger");
						if (!hasAccess) {
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

						if (link.toLowerCase() === "last") {
							const tl = sb.Command.get("tl");
							const key = createRecentTwitchLottoCacheKey(context);

							const cacheData = await tl.getCacheData(key);
							if (!cacheData) {
								return {
									success: false,
									reply: "You haven't rolled for any images in this channel recently!"
								};
							}
							else {
								link = cacheData;
							}
						}

						flags = flags.filter(i => availableFlags.includes(i.toLowerCase()));
						if (flags.length === 0) {
							return {
								success: false,
								reply: `No suitable flags provided! Here's the list: ${availableFlags.join(", ")}`
							};
						}

						const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3})/;
						const match = link.match(regex);
						if (!match) {
							return {
								success: false,
								reply: `Invalid link format!`
							};
						}

						const exists = await sb.Query.getRecordset(rs => rs
							.select("Link", "Adult_Flags")
							.from("data", "Twitch_Lotto")
							.where("Link = %s", match[4])
							.limit(1)
							.single()
						);
						if (!exists || !exists.Link) {
							return {
								success: false,
								reply: `Link does not exist in the TwitchLotto database!`
							};
						}

						if (exists.Adult_Flags === null) {
							const channels = await sb.Query.getRecordset(rs => rs
								.select("Channel")
								.from("data", "Twitch_Lotto")
								.where("Link = %s", exists.Link)
								.flat("Channel")
							);

							for (const channel of channels) {
								const row = await sb.Query.getRow("data", "Twitch_Lotto_Channel");
								await row.load(channel);
								if (row.values.Scored !== null) {
									row.values.Scored += 1;
									await row.save({ skipLoad: true });
								}
							}
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
					name: "twitchlottodescription",
					aliases: ["tld"],
					parameter: "arguments",
					description: `Add a description to any TwitchLotto picture (link).`,
					set: async (context, link, ...args) => {
						if (!link) {
							return {
								success: false,
								reply: `No link provided!`
							};
						}

						if (link.toLowerCase() === "last") {
							if (!createRecentTwitchLottoCacheKey) {
								return {
									success: false,
									reply: `This functionality is not available at the moment!`
								};
							}

							const key = createRecentTwitchLottoCacheKey(context);
							const cacheData = await sb.Command.get("tl").getCacheData(key);
							if (!cacheData) {
								return {
									success: false,
									reply: "You haven't rolled for any images in this channel recently!"
								};
							}
							else {
								link = cacheData;
							}
						}

						const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3})/;
						const match = link.match(regex);
						if (!match) {
							return {
								success: false,
								reply: `Invalid link format!`
							};
						}

						const parsedLink = await sb.Query.getRecordset(rs => rs
							.select("Link")
							.from("data", "Twitch_Lotto")
							.where("Link = %s", match[4])
							.limit(1)
							.single()
							.flat("Link")
						);

						if (!parsedLink) {
							return {
								success: false,
								reply: `Provided link (${parsedLink}) does not exist in the TwitchLotto database!`
							};
						}

						const row = await sb.Query.getRow("data", "Twitch_Lotto_Description");
						await row.load({
							Link: parsedLink,
							User_Alias: context.user.ID
						}, true);

						row.setValues({
							Link: parsedLink,
							User_Alias: context.user.ID,
							Text: args.join(" ")
						});

						await row.save({ skipLoad: true });

						return {
							reply: `Successfully added your description of link ${parsedLink}.`
						};
					}
				},
				{
					name: "twitchlottoblacklist",
					aliases: ["tlbl"],
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
						const ambassador = await context.channel.isUserAmbassador(context.user);
						const owner = await context.channel.isUserChannelOwner(context.user);
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
								reply: `No suitable flags provided! Here's the list: ${availableFlags.join(", ")}`
							};
						}

						await context.channel.setDataProperty("twitchLottoBlacklistedFlags", suitableFlags.map(i => i.toLowerCase()));
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
						const ambassador = await context.channel.isUserAmbassador(context.user);
						const owner = await context.channel.isUserChannelOwner(context.user);
						if (!ambassador && !owner) {
							return {
								success: false,
								reply: `You cannot do that here!`
							};
						}

						await context.channel.setDataProperty("twitchLottoBlacklistedFlags", []);
						return {
							reply: `Blacklisted flags successfully removed.`
						};
					}
				},
				{
					name: "instagram-nsfw",
					aliases: ["rig-nsfw"],
					parameter: "arguments",
					description: `If you are the channel ambassador/owner, you can decide if your channel will filter out NSFW Instagram links in the random Instagram command.`,
					set: async (context) => await setInstagramFlags(context, true),
					unset: async (context) => await setInstagramFlags(context, false)
				},
				{
					name: "timer",
					aliases: [],
					parameter: "arguments",
					description: `Sets/unsets a timer with a given name + date, which you can then check on later.`,
					set: async (context, ...args) => {
						const timers = await context.user.getDataProperty("timers") ?? {};
						const name = args[0];
						if (!timerNameRegex.test(name)) {
							return {
								success: false,
								reply: `Your timer name is not valid! Your timer name should only contain letters, numbers and be 2-25 characters long.`
							};
						}

						let timersCount = Object.keys(timers).length;
						if (!timers[name]) {
							timersCount += 1;
						}

						if (timersCount > timersLimit) {
							return {
								success: false,
								reply: `You have too many timers set up! Unset one first.`
							};
						}

						const date = new sb.Date(args.slice(1, 2).filter(Boolean).join(" "));
						if (Number.isNaN(date.valueOf())) {
							return {
								success: false,
								reply: `Invalid date and/or time!`
							};
						}

						timers[name] = {
							date: date.valueOf()
						};

						await context.user.setDataProperty("timers", timers);
						return {
							reply: `Successfully added your timer "${name}".`
						};
					},
					unset: async (context, name) => {
						const timers = await context.user.getDataProperty("timers");
						if (!timers) {
							return {
								success: false,
								reply: `You don't have any timers set up!`
							};
						}
						else if (!timers[name]) {
							return {
								success: false,
								reply: `You don't have this timer set up!`
							};
						}

						delete timers[name];
						await context.user.setDataProperty("timers", timers);

						return {
							reply: `Successfully removed your timer "${name}".`
						};
					}
				},
				{
					name: "trackfavourite",
					aliases: ["tf", "track-fav", "trackfavorite", "track-favourite", "track-favorite"],
					parameter: "arguments",
					description: `Lets you favourite a track in Supinic's track list from chat. Not toggleable, only sets the favourite. You can unset or check the favourite on the website. https://supinic.com/track/gachi/list`,
					set: async (context, ...args) => {
						const IDs = await fetchTrackIDs(args);
						await updateTrackFavouriteStatus(context, IDs, true);

						return {
							reply: `Successfully set ${IDs.length} track(s) as your favourite.`
						};
					},
					unset: async (context, ...args) => {
						const IDs = await fetchTrackIDs(args);
						await updateTrackFavouriteStatus(context, IDs, false);

						return {
							reply: `Successfully unset ${IDs.length} track(s) as your favourite.`
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

		const permissions = await context.getUserPermissions();
		if (target.adminOnly && !permissions.is("administrator")) {
			return {
				success: false,
				reply: `Only administrators can work with the type "${type}"!`
			};
		}
		else if (target.elevatedChannelAccess && permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: `Only channel owners and ambassadors can work with the type "${type}"!`
			};
		}

		if (target.parameter === "arguments") {
			return await target[invocation](context, ...args);
		}
		else if (target.parameter === "ID") {
			if (invocation === "unset" && context.params.from && target.userSpecificUnset) {
				return await target.userSpecificUnset(context);
			}
			else if (args.length === 0) {
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

			if (results.length === 0) {
				return await target[invocation](context);
			}
			else if (results.length === 1) {
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
