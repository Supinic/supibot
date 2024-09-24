const handleErrorInspection = require("./inspect-errors");
const { isSupported } = require("../randomline/rustlog.js");
const {
	SONG_REQUESTS_STATE,
	SONG_REQUESTS_VLC_PAUSED
} = require("../../utils/shared-cache-keys.json");

module.exports = (command) => [
	{
		name: "afk",
		aliases: [],
		description: "Use this on a user to see if they are AFK or not.",
		execute: async (context, identifier) => {
			if (!identifier) {
				return {
					success: false,
					reply: `No username provided!`
				};
			}

			const targetUser = await sb.User.get(identifier, true);
			if (!targetUser) {
				return {
					reply: "That user was not found!"
				};
			}
			else if (targetUser.Name === context.platform.Self_Name) {
				return {
					reply: "MrDestructoid I'm never AFK MrDestructoid I'm always watching MrDestructoid"
				};
			}
			if (targetUser === context.user && !context.privateMessage) {
				return {
					reply: "Using my advanced quantum processing, I have concluded that you are actually not AFK!"
				};
			}

			const afkData = await sb.Query.getRecordset(rs => rs
				.select("Text", "Started", "Silent", "Status")
				.from("chat_data", "AFK")
				.where("User_Alias = %n", targetUser.ID)
				.where("Active = %b", true)
				.single()
			);

			const pronoun = (context.user === targetUser) ? "You are" : "That user is";
			if (!afkData) {
				return {
					reply: `${pronoun} not currently AFK.`
				};
			}
			else {
				const type = (afkData.Status === "afk") ? "" : ` (${afkData.Status})`;
				const foreign = (afkData.Silent) ? "(set via different bot)" : "";
				const delta = sb.Utils.timeDelta(afkData.Started);
				return {
					reply: `${pronoun} currently AFK${type}: ${afkData.Text || "(no message)"} ${foreign} (since ${delta})`
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
			const namesList = ambassadors.map(i => `${i.Name[0]}\u{E0000}${i.Name.slice(1)}`);
			return {
				meta: {
					skipWhitespaceCheck: true
				},
				reply: `Active ambassadors in channel ${channelData.Name}: ${namesList.join(", ")}`
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
		name: "chatgpt",
		aliases: ["chat-gpt", "gpt"],
		description: "Posts either: how many tokens you (or someone else) have used recently in the $gpt command; if used with \"total\", shows your total token amount overall; or, if used with \"global\", the amount of USD @Supinic has been billed so far this month.",
		execute: async (context, target) => {
			if (target === "global") {
				// `Date.prototype.setDate` returns a number (!)
				const startDate = new sb.Date(new sb.Date().setDate(1));
				const endDate = new sb.Date(startDate.year, startDate.month + 1, 1);

				const tokenResponse = await sb.Query.getRecordset(rs => rs
					.select("COUNT(*) AS Count", "SUM(Input_Tokens) AS Input", "SUM(Output_Tokens) AS Output")
					.from("data", "ChatGPT_Log")
					.where("Executed >= %d AND Executed <= %d", startDate, endDate)
					.single()
				);

				const requests = tokenResponse.Count;
				const inputTokens = tokenResponse.Input;
				const outputTokens = tokenResponse.Output;

				const prettyMonthName = new sb.Date().format("F Y");
				return {
					reply: sb.Utils.tag.trim `
						There have been ${sb.Utils.groupDigits(requests)} 
						ChatGPT requests in ${prettyMonthName} so far. 
						${sb.Utils.groupDigits(inputTokens)} input
						and ${sb.Utils.groupDigits(outputTokens)} output tokens
						have been processed.
					`
				};
			}
			else if (target === "total") {
				const total = await sb.Query.getRecordset(rs => rs
					.select("(SUM(Input_Tokens) + SUM(Output_Tokens)) AS Total")
					.from("data", "ChatGPT_Log")
					.where("User_Alias = %n", context.user.ID)
					.flat("Total")
					.single()
				);

				if (!total) {
					return {
						reply: `You have not used any ChatGPT tokens since April 2023.`
					};
				}
				else {
					const formatted = sb.Utils.groupDigits(total);
					return {
						reply: `You have used ${formatted} ChatGPT tokens since April 2023.`
					};
				}
			}
			else {
				let GptCache;
				try {
					GptCache = require("../gpt/cache-control.js");
				}
				catch {
					return {
						success: false,
						reply: `ChatGPT caching module is currently not available!`
					};
				}

				const targetUser = (target) ? await sb.User.get(target) : context.user;
				if (!targetUser) {
					return {
						success: false,
						reply: `Provided user does not exist!`
					};
				}

				const usage = await GptCache.getTokenUsage(targetUser);
				const limits = await GptCache.determineUserLimits(targetUser);

				const externalResult = {};
				for (const [timestamp, tokens] of Object.entries(usage.summary)) {
					const pretty = new sb.Date(Number(timestamp));
					externalResult[pretty.toUTCString()] = tokens;
				}

				const pronoun = (targetUser === context.user) ? "You" : "They";
				if (usage.dailyTokens <= 0) {
					return {
						reply: `${pronoun} have not used any GPT tokens in the past 24 hours.`
					};
				}

				const externalLink = await sb.Pastebin.post(JSON.stringify(externalResult, null, 4), {
					expiration: "10 minutes",
					format: "json",
					name: `${targetUser.Name}'s usage of Supibot $gpt command`,
					privacy: "unlisted"
				});

				const dailyDigitString = sb.Utils.groupDigits(sb.Utils.round(usage.dailyTokens, 2));
				const dailyTokenString = (usage.dailyTokens !== usage.hourlyTokens)
					? `and ${dailyDigitString}/${limits.daily} tokens in the last 24 hours`
					: "";

				const externalString = (externalLink.body) ? `- full usage details: ${externalLink.body}` : "";
				return {
					reply: sb.Utils.tag.trim `
						${pronoun} have used up
						${sb.Utils.round(usage.hourlyTokens, 2)}/${limits.hourly} tokens in the last hour
						${dailyTokenString}
						${externalString}
					`
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
			/** @type {CookieData} */
			const userCookieData = await targetUser.getDataProperty("cookie");
			if (!userCookieData) {
				return {
					reply: `${pronoun} have never eaten a cookie before.`
				};
			}

			let CookieLogic;
			try {
				CookieLogic = require("../cookie/cookie-logic.js");
			}
			catch {
				return {
					success: false,
					reply: `Could not load the cookie logic module!`
				};
			}

			if (CookieLogic.hasOutdatedDailyStats(userCookieData)) {
				CookieLogic.resetDailyStats(userCookieData);
				await targetUser.setDataProperty("cookie", userCookieData);
			}

			const platform = sb.Platform.get("twitch");
			const hasDoubleCookieAccess = await platform.fetchUserAdminSubscription(targetUser);

			let string;
			if (CookieLogic.canEatReceivedCookie(userCookieData)) {
				string = `${pronoun} have a donated cookie waiting to be eaten.`;
			}
			else if (CookieLogic.canEatDailyCookie(userCookieData, { hasDoubleCookieAccess })) {
				const cookieType = CookieLogic.determineAvailableDailyCookieType(userCookieData, {
					hasDoubleCookieAccess
				});

				string = `${pronoun} have a ${cookieType} cookie waiting to be eaten.`;
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
				reply: `${string} Next reset of daily cookies will occur in ${delta}.`
			};
		}
	},
	{
		name: "deepl",
		aliases: ["DeepL"],
		description: "Checks the current usage limits of the DeepL translation engine in $translate.",
		execute: async () => {
			if (!process.env.API_DEEPL_KEY) {
				throw new sb.Error({
					message: "No DeepL key configured (API_DEEPL_KEY)"
				});
			}

			const response = await sb.Got("GenericAPI", {
				url: "https://api-free.deepl.com/v2/usage",
				headers: {
					Authorization: `DeepL-Auth-Key ${process.env.API_DEEPL_KEY}`
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
		name: "location",
		aliases: [],
		description: "Checks your or someone else's location, as set up within Supibot. Respects private locations.",
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
					reply: `My public location: Sitting on top of Supinic's LACK table`
				};
			}

			const locationData = await targetUser.getDataProperty("location");
			if (!locationData) {
				const pronoun = (context.user.ID === targetUser.ID) ? "You" : "They";
				return {
					reply: `${pronoun} have not set up a location.`
				};
			}

			const { formatted, hidden = false } = locationData;
			if (hidden) {
				if (context.user === targetUser) {
					await context.sendIntermediateMessage("As your location is private, I private messaged you with it.");
					return {
						reply: `Your private location: ${formatted}`,
						replyWithPrivateMessage: true
					};
				}
				else {
					return {
						success: false,
						reply: `That user's location is private!`
					};
				}
			}
			else {
				const pronoun = (context.user.ID === targetUser.ID) ? "Your" : "Their";
				return {
					reply: `${pronoun} public location: ${formatted}`
				};
			}
		}
	},
	{
		name: "logs",
		aliases: [],
		description: "Checks the Supibot chat line logging status of the current channel.",
		execute: async (context) => {
			if (!context.channel) {
				return {
					success: false,
					reply: `You must use this command in the channel you want to check!`
				};
			}

			const arr = [];
			if (context.channel.Logging?.has("Lines")) {
				arr.push("I am logging this channel's chat lines into a local database.");
			}
			else {
				arr.push("I am NOT logging this channel's chat lines into a local database.");
			}

			const oldLogsStatus = await context.channel.getDataProperty("logsRemovedReason");
			if (oldLogsStatus === "reinstated") {
				arr.push("I have logged this channel's chat lines before, and they have been reinstated to the IVR Rustlog service.");
			}
			else if (oldLogsStatus) {
				arr.push("I have logged this channel's chat lines before, and they COULD be reinstated to the IVR Rustlog service (create a $suggest if you would like to).");
			}
			else if (!context.channel.Logging?.has("Lines")) {
				arr.push("I have NOT logged this channel's chat lines before.");
			}

			if (context.platform.Name === "twitch") {
				if (await isSupported(context.channel.Specific_ID)) {
					arr.push("This channel is being logged by the IVR Rustlog service.");
				}
				else {
					arr.push("This channel is NOT being logged by the IVR Rustlog service.");
				}
			}

			return {
				reply: arr.join(" ")
			};
		}
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

				// If no active reminder found, check the historic table
				identifier ??= await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("chat_data", "Reminder_History")
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

			// Load active reminder
			let active = true;
			let row = await sb.Query.getRow("chat_data", "Reminder");
			await row.load(ID, true);

			// If active reminder does not exist, fall back to historic table
			if (!row.loaded) {
				active = false;
				row = await sb.Query.getRow("chat_data", "Reminder_History");
				await row.load(ID, true);
			}

			// If still nothing exists, error out
			if (!row.loaded) {
				return {
					reply: "That reminder doesn't exist!"
				};
			}

			const reminder = row.valuesObject;
			if (reminder.User_From !== context.user.ID && reminder.User_To !== context.user.ID) {
				return {
					reply: "That reminder was not created by you or for you. Stop peeking!"
				};
			}

			let status = "";
			if (!active) {
				// Only applies to Reminder_History table
				status = (reminder.Cancelled) ? "(cancelled)" : "(inactive)";
			}

			const reminderUser = (context.user.ID === reminder.User_From)
				? await sb.User.get(reminder.User_To, true)
				: await sb.User.get(reminder.User_From, true);

			const [owner, target] = (context.user.ID === reminder.User_From)
				? ["Your reminder", `to ${reminderUser.Name}`]
				: ["Reminder", `by ${reminderUser.Name} to you`];

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

			const state = await sb.Cache.getByPrefix(SONG_REQUESTS_STATE);
			const pauseState = await sb.Cache.getByPrefix(SONG_REQUESTS_VLC_PAUSED);
			const pauseString = (state === "vlc" && pauseState === true)
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

				if (!identifier) {
					return {
						success: false,
						reply: `You have never made a suggestion, so you can't check for your last one!`
					};
				}
			}

			const inputID = Number(identifier);
			if (!sb.Utils.isValidInteger(inputID, 0)) {
				return {
					success: false,
					reply: `Malformed suggestion ID provided - must be a positive integer!`
				};
			}

			const row = await sb.Query.getRow("data", "Suggestion");
			await row.load(inputID, true);
			if (!row.loaded) {
				return {
					success: false,
					reply: "No such suggestion exists!"
				};
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
			if (!link) {
				return {
					success: false,
					reply: `No image link provided! You must provide a Twitchlotto image link to check its description.`
				};
			}

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
		name: "weberror",
		aliases: ["web-error"],
		description: "If you have been granted access, you can check the full text of an error within the supinic.com website, based on its ID.",
		execute: (context, identifier) => handleErrorInspection(command, context, "webError", identifier)
	}
];
