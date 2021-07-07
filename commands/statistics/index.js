module.exports = {
	Name: "statistics",
	Aliases: ["stat","stats"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts various statistics regarding you or other users, e.g. total afk time.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "recalculate", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: [
			{
				name: "aliases",
				aliases: ["alias"],
				description: "Checks the global (or-use data for user-created supibot command aliases.",
				execute: async (context, type, user) => {
					if (user) {
						const userData = await sb.User.get(user);
						if (!userData) {
							return {
								success: false,
								reply: `Provided user does not exist!`
							};
						}

						const [aliases, copyData] = await Promise.all([
							sb.Query.getRecordset(rs => rs
								.select("COUNT(*) AS Count")
								.from("data", "Custom_Command_Alias")
								.where("User_Alias = %n", userData.ID)
								.single()
								.flat("Count")
							),
							sb.Query.getRecordset(rs => rs
								.select("Copy.User_Alias AS Copier")
								.from("data", "Custom_Command_Alias")
								.where("Custom_Command_Alias.User_Alias = %n", userData.ID)
								.join({
									alias: "Copy",
									toTable: "Custom_Command_Alias",
									on: "Copy.Parent = Custom_Command_Alias.ID"
								})
								.flat("Copier")
							)
						]);

						const copies = copyData.length;
						const users = new Set(copyData).size;
						const [who, whose] = (context.user === userData) ? ["You", "your"] : ["They", "their"];

						return {
							reply: sb.Utils.tag.trim `
								${who} currently have ${aliases} command aliases,
								and ${users} distinct users have created ${copies} copies of ${whose} aliases.
							`
						};
					}

					const [aliases, copies, users] = await Promise.all([
						sb.Query.getRecordset(rs => rs
							.select("MAX(ID) AS Max")
							.from("data", "Custom_Command_Alias")
							.single()
							.flat("Max")
						),
						sb.Query.getRecordset(rs => rs
							.select("COUNT(*) AS Count")
							.from("data", "Custom_Command_Alias")
							.where("Parent IS NOT NULL")
							.single()
							.flat("Count")
						),
						sb.Query.getRecordset(rs => rs
							.select("COUNT(DISTINCT User_Alias) AS Count")
							.from("data", "Custom_Command_Alias")
							.single()
							.flat("Count")
						)
					]);

					return {
						reply: sb.Utils.tag.trim `
							${aliases} command aliases have been created so far
							(out of which, ${copies} are direct copies of others),
							used by ${users} users in total.
						`
					};
				}
			},
			{
				name: "alias-names",
				aliases: ["aliasnames"],
				description: "Checks statistics related to custom command alias names.",
				execute: async (context, type, name) => {
					if (name) {
						const aliases = await sb.Query.getRecordset(rs => rs
							.select("Parent")
							.from("data", "Custom_Command_Alias")
							.where("Name COLLATE utf8mb4_bin = %s", name)
						);

						if (aliases.length === 0) {
							return {
								reply: `Currently, nobody has the "${name}" alias.`
							};
						}

						const copies = aliases.filter(i => i.Parent);
						return {
							reply: sb.Utils.tag.trim `
								Currently, ${aliases.length} users have the "${name}" alias.
								Out of those, ${copies.length} are copies of a different alias.
							`
						};
					}
					else {
						const aliases = await sb.Query.getRecordset(rs => rs
							.select("Name", "COUNT(*) AS Amount")
							.from("data", "Custom_Command_Alias")
							.groupBy("Name COLLATE utf8mb4_bin")
							.orderBy("COUNT(*) DESC")
						);

						const top = aliases
							.slice(0, 10)
							.map((i, ind) => `${ind + 1}) ${i.Name}: ${i.Amount}x`)
							.join(", ");

						return {
							reply: sb.Utils.tag.trim `
								Currently, ${aliases.length} unique alias names are in use.
								The 10 most used names are:
								${top}
							`
						};
					}
				}
			},
			{
				name: "afk",
				aliases: ["total-afk", "gn", "brb", "food", "shower", "lurk", "poop", "work", "study"],
				description: "Checks the total time you (or another user) have been afk for. Each status type is separate - you can use total-afk to check all of them combined.",
				execute: async (context, type, user) => {
					const targetUser = (user)
						? await sb.User.get(user)
						: context.user;

					if (!targetUser) {
						return {
							success: false,
							reply: "Provided user does not exist!"
						};
					}

					const data = await sb.Query.getRecordset(rs => {
						rs.select("COUNT(*) AS Amount")
							.select("SUM(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) AS Delta")
							.from("chat_data", "AFK")
							.where("User_Alias = %n", targetUser.ID)
							.single();

						if (type === "total-afk") {
							// Do not add a condition - counts totals
						}
						else if (type === "afk") {
							rs.where("Status = %s OR Status IS NULL", type);
						}
						else {
							rs.where("Status = %s", type);
						}

						return rs;
					});

					const who = (targetUser === context.user) ? "You have" : "That user has";
					const target = (type === "total-afk") ? "(all combined)" : type;
					if (!data?.Delta) {
						return {
							reply: `${who} not been AFK with status "${target}" at all.`
						};
					}
					else {
						const delta = sb.Utils.timeDelta(sb.Date.now() + data.Delta * 1000, true);
						const average = sb.Utils.timeDelta(sb.Date.now() + (data.Delta * 1000 / data.Amount), true);

						return {
							reply: sb.Utils.tag.trim `
								${who} been AFK with status "${target}"
								${data.Amount} times,
								for a total of ~${delta}.
								This averages to ~${average} spent AFK per invocation.
							`
						};
					}
				}
			},
			{
				name: "sr",
				aliases: [],
				description: "Checks various song requests statistics on supinic's channel.",
				execute: async function execute (context, type, ...args) {
					let branch;
					let targetUser = null;
					let videoID = null;

					if (args.length === 0) {
						branch = "user";
						targetUser = context.user;
					}
					else {
						const [target] = args;
						const userCheck = await sb.User.get(target);
						if (userCheck) {
							branch = "user";
							targetUser = userCheck;
						}
						else {
							branch = "video";
							videoID = target;
						}
					}

					if (branch === "user") {
						return await this.helpers.fetchUserStats(targetUser);
					}
					else if (branch === "video") {
						return await this.helpers.fetchVideoStats(videoID);
					}
				},

				helpers: {
					fetchUserStats: async function (targetUser) {
						const requests = await sb.Query.getRecordset(rs => rs
							.select("Link", "Length", "Start_Time", "End_Time", "Video_Type")
							.from("chat_data", "Song_Request")
							.where("User_Alias = %n", targetUser.ID)
						);

						if (requests.length === 0) {
							return {
								reply: `No requested videos found.`
							};
						}

						const counter = {};
						let totalLength = 0;
						let mostRequested = null;
						let currentMax = 0;

						for (const video of requests) {
							if (typeof counter[video.Link] === "undefined") {
								counter[video.Link] = 0;
							}

							counter[video.Link]++;
							totalLength += (video.End_Time ?? video.Length) - (video.Start_Time ?? 0);
							if (currentMax < counter[video.Link]) {
								mostRequested = video;
								currentMax = counter[video.Link];
							}
						}

						const videoType = await sb.Query.getRow("data", "Video_Type");
						await videoType.load(mostRequested.Video_Type);
						const link = videoType.values.Link_Prefix.replace("$", mostRequested.Link);

						const uniques = Object.keys(counter).length;
						const total = sb.Utils.timeDelta(sb.Date.now() + totalLength * 1000, true);
						return {
							reply: sb.Utils.tag.trim `
								Videos requested: ${requests.length} (${uniques} unique), for a total runtime of ${total}.
								The most requested video is ${link} - queued ${currentMax} times.
							`
						};
					},
					fetchVideoStats: async function (videoID) {
						if (sb.Utils.modules.linkParser.autoRecognize(videoID)) {
							videoID = sb.Utils.modules.linkParser.parseLink(videoID);
						}

						const requests = await sb.Query.getRecordset(rs => rs
							.select("Added")
							.from("chat_data", "Song_Request")
							.where("Link = %s", videoID)
							.orderBy("ID DESC")
						);

						if (requests.length === 0) {
							return {
								reply: `No videos found by given ID.`
							};
						}

						const lastDelta = sb.Utils.timeDelta(requests[0].Added);
						return {
							reply: sb.Utils.tag.trim `
								This video has been requested ${requests.length} times.
								It was last requested ${lastDelta}.
							`
						};
					}
				}
			},
			{
				name: "playsound",
				aliases: ["ps"],
				description: "Checks the amount of times a given playsound has been used.",
				execute: async (context, type, name) => {
					const data = await sb.Query.getRecordset(rs => rs
						.select("Name", "Use_Count")
						.from("data", "Playsound")
					);

					if (name === "all" || name === "total") {
						const total = data.reduce((acc, cur) => (acc += cur.Use_Count), 0);
						return {
							reply: `Playsounds have been used a total of ${total} times.`
						};
					}

					const target = data.find(i => i.Name === name);
					if (target) {
						return {
							reply: `That playsound has been used a total of ${target.Use_Count} times.`
						};
					}
					else {
						return {
							success: false,
							reply: `That playsound does not exist!`
						};
					}
				}
			},
			{
				name: "cookiecount",
				aliases: ["cc", "tcc", "cookie", "cookies"],
				description: "Fetches the amount of cookies you (or someone else) have eaten so far. If you use \"total\", then you will see the total amount of cookies eaten.",
				execute: async (context, type, user) => {
					if (user === "total" || type === "tcc") {
						const cookies = await sb.Query.getRecordset(rs => rs
							.select("SUM(Cookies_Total) AS Total", "SUM(Cookie_Gifts_Sent) AS Gifts")
							.from("chat_data", "Extra_User_Data")
							.single()
						);

						return {
							reply: `${cookies.Total} cookies have been eaten so far, out of which ${cookies.Gifts} were gifted :)`
						};
					}
					else if (user === "list") {
						return {
							reply: "Check the cookie statistics here: https://supinic.com/bot/cookie/list"
						};
					}

					const targetUser = await sb.User.get(user ?? context.user, true);
					if (!targetUser) {
						return { reply: "Target user does not exist in the database!" };
					}
					else if (targetUser.Name === context.platform.Self_Name) {
						return { reply: "I don't eat cookies, sugar is bad for my circuits!" };
					}

					const cookies = await sb.Query.getRecordset(rs => rs
						.select("Cookie_Today AS Today", "Cookies_Total AS Daily")
						.select("Cookie_Gifts_Sent AS Sent", "Cookie_Gifts_Received AS Received")
						.from("chat_data", "Extra_User_Data")
						.where("User_Alias = %n", targetUser.ID)
						.single()
					);

					const [who, target] = (context.user.ID === targetUser.ID)
						? ["You have", "you"]
						: ["That user has", "them"];

					if (!cookies || cookies.Daily === 0) {
						return { reply: `${who} never eaten a single cookie!` };
					}
					else {
						// Today = has a cookie available today
						// Daily = amount of eaten daily cookies
						// Received = amount of received cookies, independent of Daily
						// Sent = amount of sent cookies, which is subtracted from Daily

						const total = cookies.Daily + cookies.Received - cookies.Sent + cookies.Today;
						const giftedString = (cookies.Sent === 0)
							? `${who} never given out a single cookie`
							: `${who} gifted away ${cookies.Sent} cookie(s)`;

						let reaction;
						const percentage = sb.Utils.round((cookies.Sent / total) * 100, 0);
						if (percentage <= 0) {
							reaction = "😧 what a scrooge 😒";
							if (cookies.Received > 100) {
								reaction += " and a glutton 😠🍔";
							}
						}
						else if (percentage < 15) {
							reaction = "🤔 a little frugal 😑";
						}
						else if (percentage < 40) {
							reaction = "🙂 a fair person 👍";
						}
						else if (percentage < 75) {
							reaction = "😮 a great samaritan 😃👌";
						}
						else {
							reaction = "😳 an absolutely selfless saint 😇";
						}

						let voidString = "";
						if (total < cookies.Received) {
							voidString = ` (the difference of ${cookies.Received - total} has been lost to the Void)`;
						}

						return {
							reply: `${who} eaten ${total} cookies so far. Out of those, ${cookies.Received} were gifted to ${target}${voidString}. ${giftedString} ${reaction}`
						};
					}
				}
			},
			{
				name: "supibot",
				aliases: ["bot"],
				description: "Posts the link to Supibot's stats",
				execute: () => ({
					reply: "Check Supibot's statistics here: https://supinic.com/bot/stats"
				})
			},
			{
				name: "reminder",
				aliases: ["reminders"],
				description: "Shows how many times you or someone else have used reminders.",
				execute: async (context) => {
					const data = await sb.Query.getRecordset(rs => rs
						.select("SUM(Schedule IS NULL) AS Unscheduled")
						.select("SUM(Schedule IS NOT NULL) AS Scheduled")
						.from("chat_data", "Reminder")
						.where("User_From = %n", context.user.ID)
						.single()
					);

					return {
						reply: sb.Utils.tag.trim `
							So far, you have created ${data.Unscheduled} direct reminders
							and ${data.Scheduled} timed reminders,
							for a total of ${data.Unscheduled + data.Scheduled}.
						`
					};
				}
			},
			{
				name: "markov",
				aliases: [],
				description: "Returns quick stats about a markov module in a given channel.",
				execute: async (context, type, channelName) => {
					const module = sb.ChatModule.get("async-markov-experiment");
					if (!module) {
						return {
							success: false,
							reply: `No Markov module is currently available!`
						};
					}
					else if (!channelName) {
						return {
							success: false,
							reply: `No channel provided!`
						};
					}

					const channelData = sb.Channel.get(channelName ?? "forsen");
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

					return {
						reply: sb.Utils.tag.trim `
							Markov module for channel ${channelData.Name} currently has:
							${markov.size} unique words,
							and ${markov.edges ?? "(unknown)"} connections between words. 
						`
					};
				}
			},
			{
				name: "suggestion",
				aliases: ["suggest", "suggestions"],
				description: "Posts your (or someone else's) amount of suggestions, and the percentage of total. Also posts some neat links.",
				execute: async (context, type, user) => {
					const userData = (user)
						? await sb.User.get(user)
						: context.user;

					if (!userData) {
						return {
							success: false,
							reply: `Provided user does not exist!`
						};
					}

					const { data } = await sb.Got("Supinic", `/data/suggestion/stats/user/${userData.Name}`).json();
					const percent = sb.Utils.round(data.userTotal / data.globalTotal * 100, 2);
					const who = (userData === context.user) ? "You" : "They";

					return {
						reply: sb.Utils.tag.trim `
							${who} have made ${data.userTotal} suggestions, out of ${data.globalTotal} (${percent}%)							
							More info: https://supinic.com/data/suggestion/stats/user/${userData.Name}
							--
							Global suggestion stats: https://supinic.com/data/suggestion/stats
						`
					};
				}
			},
			{
				name: "twitchlotto",
				aliases: ["tl"],
				description: "Posts stats for the $twitchlotto command - globally, or for a selected channel. You can use recalculate:true to force an update for the statistics in a specific channel.",
				execute: async (context, type, channel) => {
					if (channel) {
						const lottoData = await sb.Query.getRecordset(rs => rs
							.select("Amount", "Scored", "Tagged")
							.from("data", "Twitch_Lotto_Channel")
							.where("Name = %s", channel)
							.single()
						);

						if (!lottoData) {
							return {
								success: false,
								reply: `Provided channel does not exists in the twitchlotto command!`
							};
						}

						const obj = {
							total: lottoData.Amount,
							scored: lottoData.Scored,
							tagged: lottoData.Tagged
						};

						if (context.params.recalculate) {
							const [scored, tagged, deleted] = await Promise.all([
								sb.Query.getRecordset(rs => rs
									.select("COUNT(*) AS Count")
									.from("data", "Twitch_Lotto")
									.where("Channel = %s", channel)
									.where("Score IS NOT NULL")
									.where("Available = %b OR Available IS NULL", true)
									.single()
									.flat("Count")
								),
								sb.Query.getRecordset(rs => rs
									.select("COUNT(*) AS Count")
									.from("data", "Twitch_Lotto")
									.where("Channel = %s", channel)
									.where("Score IS NOT NULL")
									.where("Adult_Flags IS NOT NULL")
									.where("Available = %b OR Available IS NULL", true)
									.single()
									.flat("Count")
								),
								sb.Query.getRecordset(rs => rs
									.select("COUNT(*) AS Count")
									.from("data", "Twitch_Lotto")
									.where("Channel = %s", channel)
									.where("Available = %b", false)
									.single()
									.flat("Count")
								)
							]);

							await sb.Query.getRecordUpdater(ru => ru
								.update("data", "Twitch_Lotto_Channel")
								.set("Scored", scored)
								.set("Tagged", tagged)
								.set("Unavailable", deleted)
								.where("Name = %s", channel)
							);

							obj.scored = scored;
							obj.tagged = tagged;
						}

						return {
							reply: sb.Utils.tag.trim `
								Channel "${channel}" has ${sb.Utils.groupDigits(obj.total)} TwitchLotto images in total.
								${sb.Utils.groupDigits(obj.scored)} have been rated by the NSFW AI,
								and out of those, ${sb.Utils.groupDigits(obj.tagged)} have been flagged by contributors.
							`
						};
					}
					else {
						const lottoData = await sb.Query.getRecordset(rs => rs
							.select("SUM(Amount) AS Amount", "SUM(Scored) AS Scored", "SUM(Tagged) AS Tagged")
							.from("data", "Twitch_Lotto_Channel")
							.single()
						);

						return {
							reply: sb.Utils.tag.trim `
								The TwitchLotto database has ${sb.Utils.groupDigits(lottoData.Amount)} images in total.
								${sb.Utils.groupDigits(lottoData.Scored)} have been rated by the NSFW AI,
								and out of those, ${sb.Utils.groupDigits(lottoData.Tagged)} have been flagged by contributors.
							`
						};
					}
				}
			}
		]
	})),
	Code: (async function statistics (context, type, ...args) {
		if (!type) {
			return {
				reply: "No statistic type provided!",
				cooldown: { length: 1000 }
			};
		}

		type = type.toLowerCase();
		const target = this.staticData.types.find(i => i.name === type || i.aliases.includes(type));

		if (target) {
			return await target.execute(context, type, ...args);
		}
		else {
			return {
				reply: "Unrecognized statistic type provided!",
				cooldown: { length: 1000 }
			};
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { types } = values.getStaticData();
		const list = types.map(i => {
			const names = [i.name, ...i.aliases].sort().map(j => `<code>${j}</code>`).join(" | ");
			return `${names}<br>${i.description}`;
		}).join("<br>");

		return [
			"Checks various statistics found around supibot's data, regarding you or a provided user - depending on the type used.",
			"",

			`<code>${prefix}stats (type)</code>`,
			"Statistics based on the type used",
			"",

			"Types:",
			`<ul>${list}</ul>`
		];
	})
};
