module.exports = {
	Name: "osrs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for whatever regarding Old School Runescape.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "activity", type: "string" },
		{ name: "boss", type: "string" },
		{ name: "force", type: "boolean" },
		{ name: "rude", type: "boolean" },
		{ name: "seasonal", type: "boolean" },
		{ name: "skill", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: ((command) => ({
		fetch: async (user, options = {}) => {
			const key = (options.seasonal)
				? { user, seasonal: true }
				: { user };

			let data = (options.force)
				? null
				: await command.getCacheData(key);

			if (!data) {
				let apiData;
				if (!options.seasonal) {
					apiData = await sb.Got("Supinic", `osrs/lookup/${user}`).json();
				}
				else {
					apiData = await sb.Got("Supinic", {
						url: `osrs/lookup/${user}`,
						searchParams: {
							seasonal: "1"
						}
					}).json();
				}

				if (!apiData.data) {
					return {
						success: false,
						reply: `No data found for player name "${user}"!`
					};
				}

				data = apiData.data;
				await command.setCacheData(key, data, {
					expiry: 600_000
				});
			}

			return data;
		},

		getIronman: (data, rude) => {
			let ironman = "user";
			if (data.ironman.deadHardcore) {
				ironman = (rude) ? "ex-hardcore ironman" : "ironman";
			}
			else if (data.ironman.regular) {
				ironman = "ironman";
			}
			else if (data.ironman.hardcore) {
				ironman = "hardcore ironman";
			}
			else if (data.ironman.ultimate) {
				ironman = "ultimate ironman";
			}

			if (ironman !== "user" && data.ironman.abandoned) {
				ironman = `de-ironed ${ironman}`;
			}

			return ironman;
		},

		subcommands: ["itemid", "kc", "price", "seasonal-kc", "seasonal-stats", "stats"],

		/* eslint-disable array-element-newline */
		activities: [
			"abyssal sire", "alchemical hydra", "barrows chests", "bounty hunter - hunter", "bounty hunter - rogue",
			"bryophyta", "callisto", "cerberus", "chambers of xeric", "chambers of xeric: challenge mode",
			"chaos elemental", "chaos fanatic", "clue scrolls (all)", "clue scrolls (beginner)", "clue scrolls (easy)",
			"clue scrolls (elite)", "clue scrolls (hard)", "clue scrolls (master)", "clue scrolls (medium)",
			"commander zilyana", "corporeal beast", "crazy archaeologist", "dagannoth prime", "dagannoth rex",
			"dagannoth supreme", "deranged archaeologist", "general graardor", "giant mole", "grotesque guardians",
			"hespori", "k'ril tsutsaroth", "kalphite queen", "king black dragon", "kraken", "kree'arra",
			"league points", "lms - rank", "mimic", "nightmare", "phosani's nightmare", "obor", "sarachnis", "scorpia",
			"skotizo", "tempoross", "the corrupted gauntlet", "the gauntlet", "theatre of blood", "theatre of blood: hard mode",
			"thermonuclear smoke devil", "tzkal-zuk", "tztok-jad", "venenatis", "vet'ion", "vorkath", "wintertodt",
			"zalcano", "zulrah"
		],
		/* eslint-enable array-element-newline */

		activityAliases: {
			"all clues": "clue scrolls (all)",
			"beginner clues": "clue scrolls (beginner)",
			"easy clues": "clue scrolls (easy)",
			"medium clues": "clue scrolls (medium)",
			"hard clues": "clue scrolls (hard)",
			"elite clues": "clue scrolls (elite)",
			"master clues": "clue scrolls (master)",
			cerb: "cerberus",
			sire: "abyssal sire",
			hydra: "alchemical hydra",
			barrows: "barrows chests",
			cox: "chambers of xeric",
			sara: "commander zilyana",
			saradomin: "commander zilyana",
			corp: "corporeal beast",
			bandos: "general graardor",
			mole: "giant mole",
			zammy: "k'ril tsutsaroth",
			kril: "k'ril tsutsaroth",
			"k'ril": "k'ril tsutsaroth",
			kq: "kalphite queen",
			kbd: "king black dragon",
			armadyl: "kree'arra",
			gauntlet: "the gauntlet",
			phosani: "phosani's nightmare",
			cg: "the corrupted gauntlet",
			"corrupted gauntlet": "the corrupted gauntlet",
			tob: "theatre of blood",
			"tob hard": "theatre of blood: hard mode",
			thermy: "thermonuclear smoke devil",
			zuk: "tzkal-zuk",
			inferno: "tzkal-zuk",
			jad: "tztok-jad",
			vetion: "vet'ion"
		},

		skills: [
			{ name: "Overall", emoji: "🏆" },
			{ name: "Attack", emoji: "⚔" },
			{ name: "Strength", emoji: "✊" },
			{ name: "Defence", emoji: "🛡" },
			{ name: "Ranged", emoji: "🏹" },
			{ name: "Prayer", emoji: "✨" },
			{ name: "Magic", emoji: "🧙‍" },
			{ name: "Runecrafting", emoji: "➰" },
			{ name: "Construction", emoji: "🏡" },
			{ name: "Hitpoints", emoji: "♥" },
			{ name: "Agility", emoji: "🏃‍" },
			{ name: "Herblore", emoji: "🌿" },
			{ name: "Thieving", emoji: "💰" },
			{ name: "Crafting", emoji: "🛠" },
			{ name: "Fletching", emoji: "🔪" },
			{ name: "Slayer", emoji: "💀" },
			{ name: "Hunter", emoji: "🐾" },
			{ name: "Mining", emoji: "⛏" },
			{ name: "Smithing", emoji: "🔨" },
			{ name: "Fishing", emoji: "🐟" },
			{ name: "Cooking", emoji: "🍲" },
			{ name: "Firemaking", emoji: "🔥" },
			{ name: "Woodcutting", emoji: "🌳" },
			{ name: "Farming", emoji: "‍🌽" }
		]
	})),
	Code: (async function osrs (context, ...args) {
		const [first] = args.splice(0, 1);
		if (!first) {
			return {
				success: false,
				reply: `Not enough arguments provided! Check the command help here: https://supinic.com/bot/command/${this.ID}`
			};
		}

		let command = first.toLowerCase();
		if (!this.staticData.subcommands.includes(command)) {
			args.unshift(first);
			command = "stats";
		}

		switch (command) {
			case "price": {
				const alias = await sb.Query.getRecordset(rs => rs
					.select("Name")
					.from("osrs", "Item")
					.where(`JSON_SEARCH(Aliases, "one", %s) IS NOT NULL`, args.join(" ").toLowerCase())
					.single()
					.limit(1)
					.flat("Name")
				);

				const query = (alias ?? args.join(" ")).toLowerCase();
				const data = await sb.Query.getRecordset(rs => {
					rs.select("Game_ID", "Name").from("osrs", "Item");

					for (const word of query.split(" ")) {
						rs.where("Name %*like*", word);
					}

					return rs;
				});

				if (data.length === 0) {
					return {
						success: false,
						reply: `No items found for given query!`
					};
				}

				const bestMatch = sb.Utils.selectClosestString(query, data.map(i => i.Name), { ignoreCase: true });
				const item = (bestMatch !== null)
					? data.find(i => i.Name.toLowerCase() === bestMatch.toLowerCase())
					: data[0];

				if (!item) {
					return {
						success: false,
						reply: "Could not match item!"
					};
				}

				// followRedirect: false and omitting `responseType` is necessary for when the API is offline
				// Apparently, Jagex's API will redirect to https://runescape.com/offline with an HTML response
				// and a 302 code - this must be caught manually, as Got will attempt to parse it as JSON and fail.
				const response = await sb.Got({
					url: "https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json",
					throwHttpErrors: false,
					followRedirect: false,
					searchParams: new sb.URLParams()
						.set("item", item.Game_ID)
						.toString()
				});

				if (response.statusCode === 302) {
					return {
						success: false,
						reply: `Old School Runescape API is currently unreachable! Please try again later, or check Twitter: https://twitter.com/oldschoolrs/`
					};
				}
				else if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `Item not found!`
					};
				}

				const { current, name, today } = JSON.parse(response.body).item;
				const wiki = `https://osrs.wiki/${item.Name.replace(/\s+/g, "_")}`;
				return {
					reply: sb.Utils.tag.trim `
						Current price of ${name}: ${current.price},
						current trend: ${today.trend} (${today.price})
						${wiki}
					`
				};
			}

			case "stats": {
				const user = args.join(" ");
				if (!user) {
					return {
						success: false,
						reply: `No player name provided!`
					};
				}

				const data = await this.staticData.fetch(user, {
					seasonal: Boolean(context.params.seasonal),
					force: Boolean(context.params.force)
				});

				if (data.success === false) {
					return data;
				}

				const accountType = (context.params.seasonal)
					? "seasonal user"
					: this.staticData.getIronman(data, Boolean(context.params.rude));

				if (context.params.skill) {
					const skillName = context.params.skill.toLowerCase();
					const skill = data.skills.find(i => i.name.toLowerCase() === skillName);

					if (!skill) {
						return {
							success: false,
							reply: `That skill does not exist!`
						};
					}
					else if (skill.level === null) {
						return {
							success: false,
							reply: `That ${accountType}'s ${context.params.skill.toLowerCase()} is not high enough level to appear on the highscores!`
						};
					}

					const { emoji } = this.staticData.skills.find(i => i.name.toLowerCase() === skillName);
					return {
						reply: sb.Utils.tag.trim `
							${sb.Utils.capitalize(accountType)} ${user}
							${emoji} ${skill.level} 
							(XP: ${sb.Utils.groupDigits(skill.experience)})
						`
					};
				}

				const strings = [];
				for (const { emoji, name } of this.staticData.skills) {
					const found = data.skills.find(i => i.name.toLowerCase() === name.toLowerCase());
					if (found && found.level !== null) {
						strings.push(`${emoji} ${found.level}`);
					}
				}

				if (strings.length === 0) {
					return {
						reply: `${sb.Utils.capitalize(accountType)} ${user} exists, but none of their stats are being tracked.`
					};
				}
				else {
					const total = data.skills.find(i => i.name.toLowerCase() === "overall");
					const totalXPString = (total)
						? `XP: ${sb.Utils.groupDigits(total.experience)}`
						: "";

					return {
						reply: sb.Utils.tag.trim `
							Stats for ${accountType} ${user}:
							${strings.join(" ")}
							${totalXPString}
						`
					};
				}
			}

			case "kc": {
				const user = args.join(" ");
				if (!user) {
					return {
						success: false,
						reply: `No user provided!`
					};
				}

				let activity = context.params.activity ?? context.params.boss;
				if (!activity) {
					return {
						success: false,
						reply: `No activity provided! Use activity:"boss name" - for a list, check here: https://supinic.com/bot/command/${this.ID}`
					};
				}

				const data = await this.staticData.fetch(user, {
					seasonal: Boolean(context.params.seasonal)
				});

				if (data.success === false) {
					return data;
				}

				if (this.staticData.activityAliases[activity.toLowerCase()]) {
					activity = this.staticData.activityAliases[activity.toLowerCase()];
				}

				const activities = data.activities.map(i => i.name.toLowerCase());
				const bestMatch = sb.Utils.selectClosestString(activity.toLowerCase(), activities, { ignoreCase: true });
				if (!bestMatch) {
					return {
						success: false,
						reply: `Invalid activity was not found! Check the list here: https://supinic.com/bot/command/${this.ID}`
					};
				}

				const { name, rank, value } = data.activities.find(i => i.name.toLowerCase() === bestMatch.toLowerCase());
				const ironman = (command.includes("seasonal"))
					? "Seasonal user"
					: sb.Utils.capitalize(this.staticData.getIronman(data, Boolean(context.params.rude)));

				return {
					reply: (rank === null)
						? `${ironman} ${user} is not ranked for ${name}.`
						: `${ironman} ${user}'s KC for ${name}: ${value} - rank #${rank}.`
				};
			}

			case "itemid": {
				const data = await sb.Query.getRecordset(rs => {
					rs.select("Game_ID", "Name")
						.from("osrs", "Item")
						.limit(5);

					for (const word of args) {
						rs.where("Name %*like*", word);
					}

					return rs;
				});

				return {
					reply: data.map(i => `${i.Name}: ${i.Game_ID}`).join("; ")
				};
			}

			default:
				return {
					success: false,
					reply: `Invalid subcommand provided! Check the help here: https://supinic.com/bot/command/${this.ID}`
				};
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { activities, activityAliases } = await values.getStaticData();
		const aliases = [];
		for (const [key, value] of Object.entries(activityAliases)) {
			aliases.push({
				activity: value,
				alias: key
			});
		}

		const list = [...activities]
			.sort()
			.map(activity => {
				let alias = "";
				const specific = aliases.filter(i => activity === i.activity).map(i => i.alias);
				if (specific.length !== 0) {
					alias = ` - aliases: ${specific.join(", ")}`;
				}

				return `<li>${activity}${alias}</li>`;
			})
			.join("");

		return [
			"Various utility commands all related to Old School Runescape.",
			"",

			"<u>Skill level overview</u>",
			`<code>${prefix}osrs (username)</code>`,
			`<code>${prefix}osrs stats (username)</code>`,
			`<code>${prefix}osrs stats (username) force:true</code>`,
			"Posts a full list of skill levels for provided user. Does not include experience or rankings.",
			`If used with "seasonal-stats", the command will attempt to use that user's seasonal profile.`,
			"Results are cached. If you would like to force a new user reload, use the <code>force:true</code> parameter.",
			"",

			"<u>Skill level detail</u>",
			`<code>${prefix}osrs (username) skill:(skill)</code>`,
			`<code>${prefix}osrs stats (username) skill:(skill)</code>`,
			"For given user, posts the skill's level, experience, and ranking.",
			`If used with "seasonal-stats", the command will attempt to use that user's seasonal profile.`,
			"",

			"<u>Kill-count</u>",
			`<code>${prefix}osrs kc activity:"(activity name)" (username)</code>`,
			`<code>${prefix}osrs kc boss:"(activity name)" (username)</code>`,
			"For given user and activity, prints their kill-count and ranking.",
			"",

			"<u>Seasonal stats</u>",
			`<code>${prefix}osrs stats <u>seasonal:true</u> (username)</code>`,
			`<code>${prefix}osrs kc <u>seasonal:true</u> activity:(activity) (username)</code>`,
			`Works the same way as the respective commands, but uses the "seasonal" hiscores.`,
			"This usually refers to Leagues, or the Deadman Mode.",
			"",

			`<u>"Rude mode"</u>`,
			`<code>${prefix}osrs stats <u>rude:true</u> (username)</code>`,
			`<code>${prefix}osrs kc <u>rude:true</u> activity:(activity) (username)</code>`,
			`Works the same way as the respective command - but when used, the command will call out dead hardcore ironmen by calling them "ex-hardcore".`,
			"If set to false, or not set at all, it will just refer to them as regular ironmen.",
			"",

			"<u>Item prices</u>",
			`<code>${prefix}osrs price (item)</code>`,
			`Posts the item's current GE price, along with trends. The most popular items also respond to aliases.`,
			"",

			"<u>Item IDs</u>",
			`<code>${prefix}osrs itemid (item)</code>`,
			`Posts the item's ingame ID. Shows up to 5 best matching results.`,
			"",

			"<h6>Supported activities</h6>",
			`<ul>${list}<ul>`
		];
	})
};
