const handleErrorInspection = require("./inspect-errors");

module.exports = (command) => [
	{
		name: "afk",
		aliases: [],
		description: "Use this on a user to see if they are AFK or not.",
		execute: async (context, identifier) => {
			if (!identifier || identifier.toLowerCase() === context.user.Name) {
				return { reply: "Using my advanced quantum processing, I have concluded that you are actually not AFK!" };
			}

			const targetUser = await sb.User.get(identifier, true);
			if (!targetUser) {
				return { reply: "That user was not found!" };
			}
			else if (targetUser.Name === context.platform.Self_Name) {
				return { reply: "MrDestructoid I'm never AFK MrDestructoid I'm always watching MrDestructoid" };
			}

			const afkData = await sb.Query.getRecordset(rs => rs
				.select("Text", "Started", "Silent", "Status")
				.from("chat_data", "AFK")
				.where("User_Alias = %n", targetUser.ID)
				.where("Active = %b", true)
				.single()
			);

			if (!afkData) {
				return {
					reply: "That user is not AFK."
				};
			}
			else {
				const type = (afkData.Status === "afk") ? "" : ` (${afkData.Status})`;
				const foreign = (afkData.Silent) ? "(set via different bot)" : "";
				const delta = sb.Utils.timeDelta(afkData.Started);
				return {
					reply: `That user is currently AFK${type}: ${afkData.Text || "(no message)"} ${foreign} (since ${delta})`
				};
			}
		}
	},
	{
		name: "alias",
		aliases: ["aliases"],
		description: "This sub-command is deprecated, check the alias command instead.",
		execute: async () => ({
			success: false,
			reply: `Use the ${sb.Command.prefix}alias list command instead! Alternatively, check its help, too.`
		})
	},
	{
		name: "ambassador",
		aliases: ["ambassadors"],
		description: "Check who is the Supibot ambassador of a channel (or the current one, if none provided).",
		execute: async (context, identifier) => {
			if (!identifier && !context.channel) {
				return {
					success: false,
					reply: `You must a provide a channel when using this command in private messages!`
				};
			}

			const channelData = (identifier)
				? sb.Channel.get(identifier)
				: context.channel;

			if (!channelData) {
				return {
					success: false,
					reply: "Provided channel does not exist!"
				};
			}

			/** @type {number[]} */
			const rawAmbassadors = await channelData.getDataProperty("ambassadors");
			if (!rawAmbassadors || rawAmbassadors.length === 0) {
				const prefix = (context.channel === channelData) ? "This" : "Target";
				return {
					reply: `${prefix} channel has no ambassadors.`
				};
			}

			const ambassadors = await sb.User.getMultiple(rawAmbassadors);
			return {
				reply: `Active ambassadors in channel ${channelData.Name}: ${ambassadors.map(i => i.Name)}`
			};
		}
	},
	{
		name: "changelog",
		aliases: [],
		description: "Posts a link to the Supibot changelog on Discord/website; or posts details about a single change, based on its ID.",
		execute: async (context, identifier) => {
			if (!identifier) {
				return {
					reply: `Changelog: https://supinic.com/data/changelog/list Discord: https://discord.com/channels/633342787869212683/748955843415900280/`
				};
			}

			const ID = Number(identifier);
			if (!sb.Utils.isValidInteger(ID)) {
				return {
					success: false,
					reply: `Invalid changelog ID provided!`
				};
			}

			const row = await sb.Query.getRow("data", "Changelog");
			await row.load(ID, true);
			if (!row.loaded) {
				return {
					success: false,
					reply: `No changelog with this ID exists!`
				};
			}

			return {
				reply: `Changelog ID ${ID}: ${row.values.Title ?? "(no title)"} Read more here: https://supinic.com/data/changelog/detail/${ID}`
			};
		}
	},
	{
		name: "command-id",
		aliases: ["cid", "CID", "commandid", "commandID"],
		description: "Checks the command execution ID for the current channel.",
		execute: async (context) => {
			const data = await sb.Query.getRecordset(rs => {
				rs.select("Executed", "Execution_Time", "Invocation")
					.from("chat_data", "Command_Execution")
					.where("User_Alias = %n", context.user.ID)
					.where("Platform = %n", context.platform.ID)
					.orderBy("Executed DESC")
					.limit(1)
					.single();

				if (context.channel === null) {
					rs.where("Channel IS NULL");
				}
				else {
					rs.where("Channel = %n", context.channel.ID);
				}

				return rs;
			});

			if (!data) {
				return {
					success: false,
					reply: "You have not executed any commands in this channel before! (except this one)"
				};
			}
			else {
				return {
					reply: `Last used command: ${sb.Command.prefix}${data.Invocation} - Identifier: ${data.Executed.valueOf()} - Execution time: ${data.Execution_Time}ms`
				};
			}
		}
	},
	{
		name: "cookie",
		aliases: [],
		description: "Checks if someone (or you, if not provided) has their fortune cookie available for today.",
		execute: async (context, identifier) => {
			let targetUser = context.user;
			if (identifier) {
				targetUser = await sb.User.get(identifier, true);
			}

			if (!targetUser) {
				return {
					success: false,
					reply: "Provided user does not exist!"
				};
			}
			else if (targetUser.Name === context.platform.Self_Name) {
				return {
					reply: "No peeking! 🍪🤖🛡 👀"
				};
			}

			const pronoun = (context.user.ID === targetUser.ID) ? "You" : "They";
			const posPronoun = (context.user.ID === targetUser.ID) ? "your" : "their";
			const userCookieData = await context.user.getDataProperty("cookie");
			if (!userCookieData) {
				return {
					reply: `${pronoun} have never eaten a cookie before.`
				};
			}

			let CookieLogic;
			try {
				CookieLogic = require("../cookie/cookie-logic.js");
			}
			catch (e) {
				return {
					success: false,
					reply: `Could not load the cookie logic module!`
				};
			}

			let string;
			if (CookieLogic.canEatDailyCookie(userCookieData)) {
				string = `${pronoun} have a daily cookie waiting to be eaten.`;
			}
			else if (CookieLogic.canEatReceivedCookie(userCookieData)) {
				string = `${pronoun} have a donated cookie waiting to be eaten.`;
			}
			else if (CookieLogic.hasDonatedDailyCookie(userCookieData)) {
				string = `${pronoun} have already donated ${posPronoun} daily cookie today.`;
			}
			else {
				string = `${pronoun} have already eaten ${posPronoun} daily cookie today.`;
			}

			const nextMidnight = new sb.Date(sb.Date.getTodayUTC()).addHours(24);
			const delta = sb.Utils.timeDelta(nextMidnight);
			return {
				reply: `${string} Next daily cookie will be available in ${delta}.`
			};
		}
	},
	{
		name: "deepl",
		aliases: ["DeepL"],
		description: "Checks the current usage limits of the DeepL translation engine in $translate.",
		execute: async () => {
			const response = await sb.Got("GenericAPI", {
				url: "https://api-free.deepl.com/v2/usage",
				headers: {
					Authorization: `DeepL-Auth-Key ${sb.Config.get("API_DEEPL_KEY")}`
				}
			});

			const data = response.body;
			const current = sb.Utils.groupDigits(data.character_count);
			const max = sb.Utils.groupDigits(data.character_limit);
			const percentage = sb.Utils.round((data.character_count / data.character_limit) * 100, 2);

			return {
				reply: `Current usage of DeepL engine API: ${current} characters used out of ${max}, which is ${percentage}%`
			};
		}
	},
	{
		name: "error",
		aliases: [],
		description: "If you have been granted access, you can check the full text of an error within Supibot, based on its ID.",
		execute: (context, identifier) => handleErrorInspection(command, context, "error", identifier)
	},
	{
		name: "mariadb",
		aliases: ["maria"],
		description: "Checks for the current memory usage of the MariaDB database process, running on Supinic's Raspberry Pi 4.",
		execute: async () => {
			const response = await sb.Got("RaspberryPi4", {
				url: "maria/memoryUsage",
				throwHttpErrors: false
			});

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: "Could not check for the process memory usage!"
				};
			}

			const uptimeVariable = await sb.Query.getRecordset(rs => rs
				.select("VARIABLE_VALUE AS Uptime")
				.from("INFORMATION_SCHEMA", "GLOBAL_STATUS")
				.where("VARIABLE_NAME = %s", "Uptime")
				.limit(1)
				.single()
				.flat("Uptime")
			);

			const uptime = sb.Utils.timeDelta(new sb.Date().addSeconds(Number(uptimeVariable)), true);
			const residental = sb.Utils.formatByteSize(response.body.data.VmRSS, 2);
			const swap = sb.Utils.formatByteSize(response.body.data.VmSwap, 2);

			return {
				reply: `The MariaDB process is running for ${uptime}, and it is currently using ${residental} of memory + ${swap} in swap.`
			};
		}
	},
	{
		name: "markov",
		aliases: [],
		description: "Posts the link for the word list, for a specified channel's markov module.",
		execute: async (context, identifier) => {
			const module = sb.ChatModule.get("async-markov-experiment");
			if (!module) {
				return {
					success: false,
					reply: `No Markov module is currently available!`
				};
			}

			const channelName = identifier ?? context.channel.Name;
			if (!channelName) {
				return {
					success: false,
					reply: `No channel provided!`
				};
			}

			const channelData = sb.Channel.get(channelName);
			if (!channelData) {
				return {
					success: false,
					reply: `Provided channel does not exist!`
				};
			}

			const markov = module.data.markovs.get(channelData.ID);
			if (!markov) {
				return {
					success: false,
					reply: "This channel does not have a markov-chain module configured!"
				};
			}
			else {
				return {
					reply: `Check this channel's markov word list here: https://supinic.com/data/other/markov/${channelData.ID}/words`
				};
			}
		}
	},
	{
		name: "poll",
		aliases: [],
		description: `Checks the currently running Supibot-related poll, if there is any.`,
		execute: async (context, identifier) => {
			const ID = Number(identifier);
			if (!ID || !sb.Utils.isValidInteger(ID)) {
				return {
					success: false,
					reply: "Invalid ID provided! Check all polls here: https://supinic.com/bot/poll/list"
				};
			}

			const poll = await sb.Query.getRecordset(rs => {
				rs.select("Text", "Status", "End", "ID")
					.from("chat_data", "Poll")
					.single();

				if (identifier) {
					rs.where("ID = %n", ID);
				}
				else {
					rs.orderBy("ID DESC").limit(1);
				}

				return rs;
			});

			if (!poll) {
				return {
					reply: "No polls match the ID provided! Check all polls here: https://supinic.com/bot/poll/list"
				};
			}

			/** @type {Object[]} */
			const votes = await sb.Query.getRecordset(rs => rs
				.select("Vote")
				.from("chat_data", "Poll_Vote")
				.where("Poll = %n", poll.ID)
			);

			if (poll.Status === "Cancelled" || poll.Status === "Active") {
				const delta = (poll.End < sb.Date.now())
					? "already ended."
					: `ends ${sb.Utils.timeDelta(poll.End)}.`;

				return {
					reply: `Poll ID ${poll.ID} ${delta} (${poll.Status}) - ${poll.Text} - Votes: ${votes.length}`
				};
			}

			const [yes, no] = sb.Utils.splitByCondition(votes, i => i.Vote === "Yes");
			return {
				reply: `Poll ID ${poll.ID} (${poll.Status}) - ${poll.Text} - Votes: ${yes.length}:${no.length}`
			};
		}
	},
	{
		name: "reminder",
		aliases: ["reminders"],
		description: "Check the status and info of a reminder created by you or for you. You can use \"last\" instead of an ID to check the last one you made.",
		execute: async (context, identifier) => {
			if (identifier === "last") {
				identifier = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("chat_data", "Reminder")
					.where("User_From = %n", context.user.ID)
					.orderBy("ID DESC")
					.limit(1)
					.single()
					.flat("ID")
				);
			}

			const ID = Number(identifier);
			if (!ID || !sb.Utils.isValidInteger(ID)) {
				return {
					reply: sb.Utils.tag.trim `
						Check all of your reminders here (requires login):
						Active - https://supinic.com/bot/reminder/list
						History - https://supinic.com/bot/reminder/history
					`
				};
			}

			const reminder = await sb.Query.getRecordset(rs => rs
				.select("ID", "User_From", "User_To", "Text", "Active", "Schedule", "Cancelled")
				.from("chat_data", "Reminder")
				.where("ID = %n", ID)
				.single()
			);

			if (!reminder) {
				return {
					reply: "That reminder doesn't exist!"
				};
			}
			else if (reminder.User_From !== context.user.ID && reminder.User_To !== context.user.ID) {
				return {
					reply: "That reminder was not created by you or for you. Stop peeking!"
				};
			}

			let status = "";
			if (!reminder.Active) {
				status = (reminder.Cancelled) ? "(cancelled)" : "(inactive)";
			}

			const reminderUser = (context.user.ID === reminder.User_From)
				? await sb.User.get(reminder.User_To, true)
				: await sb.User.get(reminder.User_From, true);

			const [owner, target] = (context.user.ID === reminder.User_From)
				? ["Your reminder", `to ${reminderUser.Name}`]
				: ["Reminder", `by ${reminderUser.Name} to you`];

			/** @type {CustomDate|null} */
			const schedule = reminder.Schedule;
			const delta = (reminder.Schedule)
				? ` (${sb.Utils.timeDelta(schedule)})`
				: "";

			return {
				reply: `${owner} ID ${ID} ${target}${delta}: ${reminder.Text} ${status}`
			};
		}
	},
	{
		name: "reset",
		aliases: [],
		description: `Checks your last "reset".`,
		execute: async (context) => {
			const last = await sb.Query.getRecordset(rs => rs
				.select("Timestamp")
				.from("data", "Reset")
				.where("User_Alias = %n", context.user.ID)
				.orderBy("ID DESC")
				.limit(1)
				.single()
			);

			return {
				reply: (last)
					? `Your last "reset" was ${sb.Utils.timeDelta(last.Timestamp)}.`
					: `You have never noted down a "reset" before.`
			};
		}
	},
	{
		name: "slots",
		aliases: [],
		description: "Posts the link to all winners for the slots command.",
		execute: () => ({
			reply: `Check all winners here: https://supinic.com/data/slots-winner/list`
		})
	},
	{
		name: "sr",
		aliases: ["songrequests"],
		description: `For supinic's Twitch channel, checks the current status of song requests.`,
		execute: async (context) => {
			if (context.channel?.ID !== 38) {
				return {
					success: false,
					reply: "Only usable in Supinic's Twitch channel!"
				};
			}

			const state = sb.Config.get("SONG_REQUESTS_STATE");
			const pauseString = (state === "vlc" && sb.Config.get("SONG_REQUESTS_VLC_PAUSED"))
				? "Song requests are paused at the moment."
				: "";

			return {
				reply: `Current song requests status: ${state}. ${pauseString}`
			};
		}
	},
	{
		name: "subscription",
		aliases: ["subscriptions", "sub", "subs"],
		description: "Fetches the list of your active event subscriptions within Supibot.",
		execute: async (context) => {
			const types = await sb.Query.getRecordset(rs => rs
				.select("Type")
				.from("data", "Event_Subscription")
				.where("User_Alias = %n", context.user.ID)
				.where("Active = %b", true)
				.orderBy("Type")
				.flat("Type")
			);

			if (types.length === 0) {
				return {
					reply: "You're currently not subscribed to any Supibot event."
				};
			}
			else {
				return {
					reply: `You're currently subscribed to these events: ${types.join(", ")}`
				};
			}
		}
	},
	{
		name: "suggest",
		aliases: ["suggestion", "suggestions"],
		description: "Checks the status and info of a suggestion that you made. You can use \"last\" instead of an ID to check the last one you made.",
		execute: async (context, identifier) => {
			if (!identifier) {
				return {
					reply: sb.Utils.tag.trim `
						All suggestions: https://supinic.com/data/suggestion/list
						Your active suggestions: https://supinic.com/data/suggestion/list/active?columnAuthor=${context.user.Name}
						Your previous suggestions: https://supinic.com/data/suggestion/list/resolved?columnAuthor=${context.user.Name}
					`
				};
			}

			if (identifier === "last") {
				identifier = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Suggestion")
					.where("User_Alias = %n", context.user.ID)
					.orderBy("ID DESC")
					.limit(1)
					.single()
					.flat("ID")
				);
			}

			const row = await sb.Query.getRow("data", "Suggestion");
			try {
				await row.load(Number(identifier));
			}
			catch {
				return { reply: "No such suggestion exists!" };
			}

			const {
				ID,
				Date: date,
				Last_Update: update,
				Status: status,
				Text: text,
				User_Alias: user
			} = row.values;

			if (status === "Quarantined") {
				return {
					reply: "This suggestion has been quarantined."
				};
			}

			const updated = (update)
				? `, last updated ${sb.Utils.timeDelta(update)}`
				: "";

			const userData = await sb.User.get(user, true);
			return {
				reply: sb.Utils.tag.trim `
							Suggestion ID ${ID}
							from ${userData.Name}:
							status ${status ?? "Pending review"}
							(posted ${sb.Utils.timeDelta(date)}${updated}):
							${text}
							Detail: https://supinic.com/data/suggestion/${ID}
						`
			};
		}
	},
	{
		name: "timer",
		aliases: ["timers"],
		description: "If you have set a timer, this will show its name and date.",
		execute: async (context, identifier) => {
			const timers = await context.user.getDataProperty("timers");
			if (!timers) {
				return {
					success: false,
					reply: `You don't have any timers set up!`
				};
			}

			if (!identifier) {
				const timerNames = Object.keys(timers).sort();
				return {
					reply: `You have ${timerNames.length} timers: ${timerNames.join(", ")}`
				};
			}
			else if (!timers[identifier]) {
				return {
					success: false,
					reply: `You don't have this timer set up!`
				};
			}

			const now = sb.Date.now();
			const date = new sb.Date(timers[identifier].date);
			const delta = sb.Utils.timeDelta(date);
			const verb = (now > date) ? "occured" : "occurs";

			return {
				reply: `Your timer "${identifier}" ${verb} ${delta}.`
			};
		}
	},
	{
		name: "twitchlottoblacklist",
		aliases: ["tlbl"],
		description: "If the current channel has a TwitchLotto blacklist setup, this will post it.",
		execute: async (context) => {
			if (!context.channel) {
				return {
					success: false,
					reply: `There are no flags to be found here!`
				};
			}

			const flags = await context.channel.getDataProperty("twitchLottoBlacklistedFlags");
			return {
				reply: (!flags || flags.length === 0)
					? `There are currently no blacklisted TL flags in this channel.`
					: `Currently blacklisted flags in this channel: ${flags.join(", ")}`
			};
		}
	},
	{
		name: "twitchlottodescription",
		aliases: ["tld"],
		description: "Checks the posted description of a provided TwitchLotto link, if it exists.",
		execute: async (context, link) => {
			// @todo refactor this and similar usages to a common place
			if (link.toLowerCase() === "last") {
				const tl = sb.Command.get("tl");
				const definitions = require("../twitchlotto/definitions.js");
				const key = definitions.createRecentUseCacheKey(context);

				// Seems like a mismatched documentation - tl.getCacheData can allow objects too
				// noinspection JSCheckFunctionSignatures
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

			const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3})/;
			const match = link.match(regex);
			if (!match) {
				return {
					success: false,
					reply: `Invalid link format!`
				};
			}

			const descriptions = await sb.Query.getRecordset(rs => rs
				.select("User_Alias", "Text")
				.from("data", "Twitch_Lotto_Description")
				.where("Link = %s", match[4])
				.orderBy("Preferred DESC")
			);

			if (descriptions.length === 0) {
				const exists = await sb.Query.getRecordset(rs => rs
					.select("Link")
					.from("data", "Twitch_Lotto")
					.where("Link = %s", match[4])
					.limit(1)
					.flat("Link")
					.single()
				);

				return {
					success: false,
					reply: (exists)
						? `This picture either has not been described so far!`
						: `This picture does not exist in the database!`
				};
			}

			const item = descriptions[context.params.index ?? 0];
			if (!item) {
				return {
					success: false,
					reply: `There is no description with this index!`
				};
			}

			const authorData = await sb.User.get(item.User_Alias);
			return {
				reply: `(Use index:0 to index:${descriptions.length}) Description from ${authorData.Name}: ${item.Text}`
			};
		}
	},
	{
		name: "userdatalength",
		aliases: ["udl"],
		description: "Checks the size of a user's (or yours) Data within Supibot.",
		execute: async (context, user) => {
			const userData = await sb.User.get(user ?? context.user);
			if (!userData) {
				return {
					success: false,
					reply: "Invalid user provided!"
				};
			}

			const length = await sb.Query.getRecordset(rs => rs
				.select("LENGTH(IFNULL(Data, '')) AS Size")
				.from("chat_data", "User_Alias")
				.where("ID = %n", userData.ID)
				.limit(1)
				.single()
				.flat("Size")
			);

			if (typeof length !== "number") {
				return {
					success: false,
					reply: `Could not retrieve the user data length!`
				};
			}
			else {
				// 65k = limit of TEXT (current User_Alias.Data type)
				const percent = sb.Utils.round((length / 65535) * 100, 2);
				const prefix = (context.user === userData) ? "Your" : "Their";
				const size = sb.Utils.formatByteSize(length);

				return {
					reply: `${prefix} user data currently occupies ${size} (${percent}% of maximum) in Supibot's database.`
				};
			}
		}
	},
	{
		name: "weberror",
		aliases: ["web-error"],
		description: "If you have been granted access, you can check the full text of an error within the supinic.com website, based on its ID.",
		execute: (context, identifier) => handleErrorInspection(command, context, "webError", identifier)
	}
];
