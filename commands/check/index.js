module.exports = {
	Name: "check",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks certain user or system variables. For a list of types, check the command's extended help.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		variables: [
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
				description: "Checks your currently active aliases, or the definition of a specific one.",
				execute: async (context, identifier) => {
					const aliases = context.user.Data.aliasedCommands;
					if (!aliases || Object.keys(aliases).length === 0) {
						return {
							success: false,
							reply: `You don't have any active aliases at the moment!`
						};
					}
	
					if (!identifier) {
						return {
							reply: `List: ${Object.keys(aliases).sort().join(", ")}`
						};
					}
					else if (!aliases[identifier]) {
						return {
							success: false,
							reply: `You don't have an active alias with that name!`
						};
					}
	
					const { invocation, args } = aliases[identifier];
					return {
						reply: `Definition: ${invocation} ${args.join(" ")}`
					};
				}
			},
			{
	
				name: "ambassador",
				aliases: ["ambassadors"],
				description: "Check who is the Supibot ambassador of a channel (or the current one, if none provided).",
				execute: async (context, identifier) => {
					const channelData = (identifier)
						? sb.Channel.get(identifier)
						: context.channel;
	
					if (!channelData) {
						return {
							success: false,
							reply: "Target channel does not exist!"
						};
					}
					else if (!channelData.Data.ambassadors || channelData.Data.ambassadors.length === 0) {
						return {
							reply: "Target channel has no ambassadors."
						};
					}
	
					const ambassadors = await sb.User.getMultiple(channelData.Data.ambassadors);
					return {
						reply: `Active ambassadors: ${ambassadors.map(i => i.Name)}`
					};
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
					const check = await sb.Query.getRecordset(rs => rs
						.select("Cookie_Today", "Cookie_Is_Gifted")
						.from("chat_data", "Extra_User_Data")
						.where("User_Alias = %n", targetUser.ID)
						.single()
					);
	
					let string = null;
					if (!check) {
						string = pronoun + " have never eaten a cookie before.";
					}
					else if (check.Cookie_Today) {
						string = (check.Cookie_Is_Gifted)
							? pronoun + " have already eaten the daily and gifted cookie today."
							: pronoun + " have already eaten/gifted the daily cookie today.";
	
						const date = new sb.Date().addDays(1);
						date.setUTCHours(0, 0, 0, 0);
	
						string += ` The next cookie will be available in ${sb.Utils.timeDelta(date)}.`;
					}
					else {
						string = (check.Cookie_Is_Gifted)
							? pronoun + " have a gifted cookie waiting."
							: pronoun + " have an unused cookie waiting.";
					}
	
					return {
						reply: string
					};
				}
			},
			{
				name: "error",
				aliases: [],
				description: "If you are marked as a developer, you can check the full text of an error within Supibot, based on its ID.",
				execute: async (context, identifier) => {
					if (!context.user.Data.inspectErrorStacks) {
						return {
							reply: "Sorry, you can't inspect error stacks!"
						};
					}
	
					if (!Number(identifier)) {
						return {
							reply: "Invalid ID provided!"
						};
					}
	
					const row = await sb.Query.getRow("chat_data", "Error");
					try {
						await row.load(Number(identifier));
					}
					catch {
						return {
							reply: "No such error exists!"
						};
					}
	
					const { ID, Stack: stack } = row.values;
	
					if (!this.data.cache) {
						this.data.cache = {};
					}
					if (!this.data.cache[ID] || this.data.cache[ID].expiration < sb.Date.now()) {
						this.data.cache[ID] = {
							createdAt: sb.Date.now(),
							expiration: new sb.Date().addHours(1).valueOf(),
							link: await sb.Pastebin.post(stack, {
								name: "Stack of Supibot error ID " + ID,
								expiration: "1H"
							})
						};
					}
	
					if (context.channel) {
						await context.channel.send("The error stack Pastebin link has been whispered to you 💻");
					}
	
					return {
						reply: this.data.cache[ID].link,
						replyWithPrivateMessage: true
					}
				}
			},
			{
				name: "poll",
				aliases: [],
				description: `Checks the currently running Supibot-related poll, if there is any.`,
				execute: async (context, identifier) => {
					if (identifier && !Number(identifier)) {
						return {
							reply: "Invalid ID provided!"
						};
					}
	
					const poll = await sb.Query.getRecordset(rs => {
						rs.select("Text", "Status", "End", "ID")
							.from("chat_data", "Poll")
							.single();
	
						if (identifier) {
							rs.where("ID = %n", Number(identifier));
						}
						else {
							rs.orderBy("ID DESC").limit(1);
						}
	
						return rs;
					});
	
					if (!poll) {
						return {
							reply: "No polls match the ID provided!"
						};
					}
					else if (poll.Status === "Cancelled" || poll.Status === "Active") {
						const delta = (poll.End < sb.Date.now())
							? "already ended."
							: `ends in ${sb.Utils.timeDelta(poll.End)}.`;
	
						return {
							reply: `Poll ID ${poll.ID} ${delta} (${poll.Status}) - ${poll.Text}`
						};
					}
	
					const votes = await sb.Query.getRecordset(rs => rs
						.select("Vote")
						.from("chat_data", "Poll_Vote")
						.where("Poll = %n", poll.ID)
					);
	
					const [yes, no] = sb.Utils.splitByCondition(votes, i => i.Vote === "Yes");
					return {
						reply: `Poll ID ${poll.ID} (${poll.Status}) - ${poll.Text} - Votes: ${yes.length}:${no.length}`
					}
				}
			},
			{
				name: "reminder",
				aliases: ["reminders"],
				description: "Check the status and info of a reminder created by you or for you.",
				execute: async (context, identifier) => {
					const ID = Number(identifier);
					if (!ID) {
						return {
							reply: "Check all of your reminders here (requires login): https://supinic.com/bot/reminder/list"
						};
					}
	
					const reminder = await sb.Query.getRecordset(rs => rs
						.select("ID", "User_From", "User_To", "Text", "Active", "Schedule")
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
	
					const alreadyFired = (reminder.Active) ? "" : "(inactive)";
					const reminderUser = (context.user.ID === reminder.User_From)
						? await sb.User.get(reminder.User_To, true)
						: await sb.User.get(reminder.User_From, true);
	
					const [owner, target] = (context.user.ID === reminder.User_From)
						? ["Your reminder", "to " + reminderUser.Name]
						: ["Reminder", "by " + reminderUser.Name + " to you"];
	
					const delta = (reminder.Schedule)
						? ` (${sb.Utils.timeDelta(reminder.Schedule)})`
						: "";
	
					return {
						reply: `${owner} ID ${ID} ${target}${delta}: ${reminder.Text} ${alreadyFired}`
					}
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
					}
				}
			},
			{
				name: "slots",
				aliases: [],
				description: "Posts the link to all winners for the slots command.",
				execute: () => ({
					reply: `Check all winners here: https://supinic.com/bot/slots-winner/list`
				})
			},
			{
				name: "sr",
				aliases: ["songrequests"],
				description: `For supinic's Twitch channel, checks the current status of song requests.`,
				execute: async (context) => {
					if (context?.channel.ID !== 38) {
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
						.from("chat_data", "Event_Subscription")
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
							reply: "You're currently subscribed to these events: " + types.join(", ")
						};
					}
				}
			},
			{
				name: "suggest",
				aliases: ["suggestion", "suggestions"],
				description: "Checks the status and info of a suggestion that you made.",
				execute: async (context, identifier) => {
					if (!identifier) {
						return {
							reply: sb.Utils.tag.trim `
							Check all suggestions:
							https://supinic.com/data/suggestion/list
							||
							Your suggestions:
							https://supinic.com/data/suggestion/list?columnAuthor=${context.user.Name}
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
						status ${status}
						(posted ${sb.Utils.timeDelta(date)}${updated}):
						${text}
						Detail: https://supinic.com/data/suggestion/${ID}
					`
					};
				}
			}
		]
	})),
	Code: (async function check (context, type, identifier) {
		if (!type) {
			return {
				success: false,
				reply: `No type provided! https://supinic.com/bot/command/${this.ID}`
			};
		}
	
		const item = this.staticData.variables.find(i => i.name === type || i.aliases.includes(type));
		if (!item) {
			return {
				success: false,
				reply: `Invalid type provided! https://supinic.com/bot/command/${this.ID}`
			};
		}
	
		return await item.execute(context, identifier);
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { variables } = values.getStaticData();
		const list = variables.map(i => {
			const aliases = (i.aliases && i.aliases.length > 0)
				? ` (${i.aliases.join(", ")})`
				: "";
	
			return `<li><code>${i.name}${aliases}</code> - ${i.description}</li>`;
		});
	
		return [
			"Checks variables that you have been set within Supibot",
			"",
	
			`<code>${prefix}check (variable)</code>`,
			"Checks the status of a given variable.",
			"",
	
			"Supported types:",
			"<ul>" + list.join("") + "</ul>"
		];
	
	})
};