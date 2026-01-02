import {
	flags,
	createRecentUseCacheKey as createRecentTwitchLottoCacheKey
} from "../../twitchlotto/definitions.js";

const availableFlags = flags.map(i => i.name.toLowerCase());

export default [
	{
		name: "twitchlotto",
		aliases: ["tl"],
		parameter: "arguments",
		description: `If you have been nominated as a TwitchLotto-trusted user, you can then set flags to TL links. Available flags: <code>${availableFlags.join(", ")}</code>`,
		flags: {
			pipe: true
		},
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
				const key = createRecentTwitchLottoCacheKey(context);
				const cacheData = await core.Cache.getByPrefix(key);
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

			const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3,4})/;
			const match = link.match(regex);
			if (!match) {
				return {
					success: false,
					reply: `Invalid link format!`
				};
			}

			const exists = await core.Query.getRecordset(rs => rs
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
				const channels = await core.Query.getRecordset(rs => rs
					.select("Channel")
					.from("data", "Twitch_Lotto")
					.where("Link = %s", exists.Link)
					.flat("Channel")
				);

				for (const channel of channels) {
					const row = await core.Query.getRow("data", "Twitch_Lotto_Channel");
					await row.load(channel);
					if (row.values.Scored !== null) {
						row.values.Scored += 1;
						await row.save({ skipLoad: true });
					}
				}
			}

			await core.Query.getRecordUpdater(ru => ru
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
		flags: {
			pipe: true
		},
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

			const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3,4})/;
			const match = link.match(regex);
			if (!match) {
				return {
					success: false,
					reply: `Invalid link format!`
				};
			}

			/** @type {string|undefined} */
			const parsedLink = await core.Query.getRecordset(rs => rs
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

			const row = await core.Query.getRow("data", "Twitch_Lotto_Description");
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
		flags: {
			pipe: false // administrative action
		},
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
	}
];
