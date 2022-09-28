module.exports = {
	Name: "osrs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for whatever regarding Old School Runescape.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "activity", type: "string" },
		{ name: "boss", type: "string" },
		{ name: "force", type: "boolean" },
		{ name: "rude", type: "boolean" },
		{ name: "seasonal", type: "boolean" },
		{ name: "skill", type: "string" },
		{ name: "virtual", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: ((command) => ({
		fetch: async (user, options = {}) => {
			const commandObject = command ?? this;

			const key = (options.seasonal)
				? { user, seasonal: true }
				: { user };

			let data = (options.force)
				? null
				: await commandObject.getCacheData(key);

			if (!data) {
				let response;
				if (!options.seasonal) {
					response = await sb.Got("Supinic", {
						url: `osrs/lookup/${user}`
					});
				}
				else {
					response = await sb.Got("Supinic", {
						url: `osrs/lookup/${user}`,
						searchParams: {
							seasonal: "1"
						}
					});
				}

				if (response.statusCode === 404 || !response.body.data) {
					return {
						success: false,
						reply: `No data found for player name "${user}"!`
					};
				}

				data = response.body.data;
				await commandObject.setCacheData(key, data, {
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

		subcommands: [
			"guthix",
			"itemid",
			"kc",
			"price",
			"search",
			"seasonal-kc",
			"seasonal-stats",
			"stats",
			"tears",
			"tog",
			"wiki"
		],

		/* eslint-disable array-element-newline */
		activities: [
			"abyssal sire", "alchemical hydra", "barrows chests", "bounty hunter - hunter", "bounty hunter - rogue",
			"bryophyta", "callisto", "cerberus", "chambers of xeric", "chambers of xeric: challenge mode",
			"chaos elemental", "chaos fanatic", "clue scrolls (all)", "clue scrolls (beginner)", "clue scrolls (easy)",
			"clue scrolls (elite)", "clue scrolls (hard)", "clue scrolls (master)", "clue scrolls (medium)",
			"commander zilyana", "corporeal beast", "crazy archaeologist", "dagannoth prime", "dagannoth rex",
			"dagannoth supreme", "deranged archaeologist", "general graardor", "giant mole", "grotesque guardians",
			"guardians of the rift", "hespori", "k'ril tsutsaroth", "kalphite queen", "king black dragon", "kraken", "kree'arra",
			"league points", "lms - rank", "mimic", "nex", "nightmare", "phosani's nightmare", "obor", "sarachnis", "scorpia",
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
			gotr: "guardians of the rift",
			rifts: "guardians of the rift",
			"rifts closed": "guardians of the rift",
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
			toa: "tombs of amascut",
			"toa hard": "tombs of amascut: expert mode",
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
			{ name: "Runecraft", emoji: "➰" },
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
				reply: `Not enough arguments provided! Check the command help here: ${this.getDetailURL()}`
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
				const response = await sb.Got("GenericAPI", {
					url: "https://prices.runescape.wiki/api/v1/osrs/latest",
					throwHttpErrors: false,
					searchParams: {
						id: item.Game_ID
					}
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `Item not found!`
					};
				}

				const formatPrice = (price) => {
					if (price < 1000) {
						return price;
					}
					else {
						return sb.Utils.formatSI(price, "", 3, true).replace("G", "B");
					}
				};

				const itemData = response.body.data[item.Game_ID];
				const { low, high } = itemData;
				const priceString = (low === high)
					? `${formatPrice(low)} gp`
					: `${formatPrice(low)} gp - ${formatPrice(high)} gp`;

				// const lowDelta = sb.Utils.timeDelta(new sb.Date(itemData.lowTime * 1000));
				// const highDelta = sb.Utils.timeDelta(new sb.Date(itemData.highTime * 1000));

				const wiki = `https://prices.runescape.wiki/osrs/item/${item.Game_ID}`;
				return {
					reply: sb.Utils.tag.trim `
						Current price range of ${item.Name}:
						${priceString}
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
					const [topMatch] = sb.Utils.selectClosestString(skillName, data.skills.map(i => i.name), {
						fullResult: true,
						ignoreCase: true
					});

					if (topMatch.score < 0.5) {
						return {
							success: false,
							reply: "No valid skill matching your query has been found!"
						};
					}

					const skill = data.skills.find(i => i.name.toLowerCase() === topMatch.string.toLowerCase());
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

					const { emoji } = this.staticData.skills.find(i => i.name.toLowerCase() === topMatch.string.toLowerCase());
					const experience = (skill.experience === -1)
						? "(unranked)"
						: sb.Utils.groupDigits(skill.experience);

					const level = (context.params.virtual) ? skill.virtualLevel : skill.level;
					return {
						reply: sb.Utils.tag.trim `
							${sb.Utils.capitalize(accountType)} ${user}
							${emoji} ${level} 
							(XP: ${experience})
						`
					};
				}

				const strings = [];
				for (const { emoji, name } of this.staticData.skills) {
					const found = data.skills.find(i => i.name.toLowerCase() === name.toLowerCase());
					if (found && found.level !== null) {
						const level = (context.params.virtual)
							? (found.virtualLevel ?? found.level)
							: found.level;

						strings.push(`${emoji} ${level}`);
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

					const combatLevelString = (data.combatLevel !== null)
						? `Combat level: ${data.combatLevel}`
						: "";

					return {
						reply: sb.Utils.tag.trim `
							Stats for ${accountType} ${user}:
							${strings.join(" ")}
							|
							${totalXPString}
							|
							${combatLevelString}
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
						reply: `No activity provided! Use activity:"boss name" - for a list, check here: ${this.getDetailURL()}`
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
						reply: `Invalid activity was not found! Check the list here: ${this.getDetailURL()}`
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

			case "tog":
			case "tears":
			case "guthix": {
				const response = await sb.Got("GenericAPI", {
					url: "https://www.togcrowdsourcing.com/worldinfo"
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `The Crowdsourcing API failed! Try again later.`
					};
				}

				const worlds = response.body;
				if (!Array.isArray(worlds) || worlds.length === 0) {
					return {
						success: false,
						reply: `No crowdsourced data is currently available! Try again later.`
					};
				}

				const idealWorlds = worlds.filter(i => i.stream_order === "gggbbb");
				const string = idealWorlds.map(i => `W${i.world_number} (${i.hits} hits)`).join(", ");

				return {
					reply: `Ideal Tears of Guthix worlds (GGGBBB): ${string}`
				};
			}

			case "search":
			case "wiki": {
				const search = args.join(" ");
				if (!search) {
					return {
						success: false,
						reply: `No input provided!`
					};
				}

				const response = await sb.Got("GenericAPI", {
					url: "https://oldschool.runescape.wiki/w/api.php",
					responseType: "text",
					throwHttpErrors: false,
					searchParams: { search }
				});

				if (response.redirectUrls.length !== 0) {
					const $ = sb.Utils.cheerio(response.body);
					const summary = $($("#mw-content-text p")[0]).text();
					const url = $("link[rel='canonical']")?.attr("href")?.replace("oldschool.runescape.wiki", "osrs.wiki") ?? "(no link)";

					return {
						reply: `${url} ${summary}`
					};
				}
				else {
					return {
						reply: `No direct match, try this search link: https://osrs.wiki/?search=${encodeURIComponent(search)}`
					};
				}
			}

			default:
				return {
					success: false,
					reply: `Invalid subcommand provided! Check the help here: ${this.getDetailURL()}`
				};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const { activities, activityAliases, skills } = this.staticData;
		const aliases = [];
		for (const [key, value] of Object.entries(activityAliases)) {
			aliases.push({
				activity: value,
				alias: key
			});
		}

		const activityList = [...activities]
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

		const skillList = [...skills]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li>${i.name} - ${i.emoji}</li>`)
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

			"<u>Virtual levels</u>",
			`<code>${prefix}osrs (username) skill:(skill) virtual:true</code>`,
			`<code>${prefix}osrs (username) virtual:true</code>`,
			"Will take into account virtual levels.",
			"",

			"<u>Skills and used emojis</u>",
			`<ul>${skillList}</ul>`,
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

			"<u>Search the Wiki</u>",
			`<code>${prefix}osrs search (query)</code>`,
			`Attempts to post a direct OSRS Wiki link to whatever you're looking for.`,
			"",

			"<u>Item prices</u>",
			`<code>${prefix}osrs price (item)</code>`,
			`Posts the item's current GE price, along with trends. The most popular items also respond to aliases.`,
			"",

			"<u>Item IDs</u>",
			`<code>${prefix}osrs itemid (item)</code>`,
			`Posts the item's ingame ID. Shows up to 5 best matching results.`,
			"",

			"<u>Tears of Guthix</u>",
			`<code>${prefix}osrs tog</code>`,
			`<code>${prefix}osrs tears</code>`,
			`<code>${prefix}osrs guthix</code>`,
			`Posts the list of "ideal" worlds for Tears of Guthix.`,
			`Powered by <a href="https://github.com/jcarbelbide/tog-crowdsourcing-server">Tears of Guthix Crowdsourcing API</a>.`,
			"",

			"<h6>Supported activities</h6>",
			`<ul>${activityList}<ul>`
		];
	})
};
