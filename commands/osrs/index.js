module.exports = {
	Name: "osrs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for whatever regarding Old School Runescape.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: ((command) => ({
		fetch: async (user, options = {}) => {
			const key = (options.seasonal)
				? { user, seasonal: true }
				: { user };
	
			let data = await command.getCacheData(key);
			if (!data) {
				let apiData;
				if (!options.seasonal) {
					apiData = await sb.Got("Supinic", {
						url: "osrs/lookup/" + user,
						timeout: 10000
					}).json();
				}
				else {
					apiData = await sb.Got("Supinic", {
						url: "osrs/lookup/" + user,
						searchParams: new sb.URLParams().set("seasonal", "1").toString(),
						timeout: 10000,
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
	
		getIronman: (data) => {
			let ironman = "user";
			if (data.ironman.regular) {
				ironman = "ironman";
			}
			else if (data.ironman.hardcore) {
				ironman = "hardcore ironman";
			}
			else if (data.ironman.ultimate) {
				ironman = "ultimate ironman";
			}
	
			return ironman;
		},
	
		subcommands: ["itemid", "kc", "price", "seasonal-kc", "seasonal-stats", "stats"],
	
		activities: [
			"abyssal sire", "alchemical hydra", "barrows chests", "bounty hunter - hunter", "bounty hunter - rogue",
			"bryophyta", "callisto", "cerberus", "chambers of xeric", "chambers of xeric: challenge mode", "chaos elemental",
			"chaos fanatic", "clue scrolls (all)", "clue scrolls (beginner)", "clue scrolls (easy)", "clue scrolls (elite)",
			"clue scrolls (hard)", "clue scrolls (master)", "clue scrolls (medium)", "commander zilyana", "corporeal beast", 
			"crazy archaeologist", "dagannoth prime", "dagannoth rex", "dagannoth supreme", "deranged archaeologist",
			"general graardor", "giant mole", "grotesque guardians", "hespori", "k'ril tsutsaroth", "kalphite queen", 
			"king black dragon", "kraken", "kree'arra", "league points", "lms - rank", "mimic", "nightmare", "obor", "sarachnis",
			"scorpia", "skotizo", "the corrupted gauntlet", "the gauntlet", "theatre of blood", "thermonuclear smoke devil",
			"tzkal-zuk", "tztok-jad", "venenatis", "vet'ion", "vorkath", "wintertodt", "zalcano", "zulrah"
		],
	
		activityAliases: {
			"sire": "abyssal sire",
			"hydra": "alchemical hydra",
			"barrows": "barrows chests",
			"cox": "chambers of xeric",
			"sara": "commander zilyana",
			"saradomin": "commander zilyana",
			"corp": "corporeal beast",
			"bandos": "general graardor",
			"mole": "giant mole",
			"zammy": "k'ril tsutsaroth",
			"kq": "kalphite queen",
			"kbd": "king black dragon",
			"armadyl": "kree'arra",
			"gauntlet": "the gauntlet",
			"corrupted gauntlet": "the corrupted gauntlet",
			"tob": "theatre of blood",
			"thermy": "thermonuclear smoke devil",
			"zuk": "tzkal-zuk",
			"inferno": "tzkal-zuk",
			"jad": "tztok-jad",
			"vetion": "vet'ion",
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
			{ name: "Farming", emoji: "‍🌽" },
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
	
				const { statusCode, body: detail } = await sb.Got({
					url: "https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json",
					throwHttpErrors: false,
					responseType: "json",
					searchParams: new sb.URLParams()
						.set("item", item.Game_ID)
						.toString()
				});
	
				if (statusCode !== 200) {
					return {
						success: false,
						reply: `Item not found!`
					};
				}
	
				const { current, today } = detail.item;
				const wiki = "https://osrs.wiki/" + item.Name.replace(/\s+/g, "_");
				return {
					reply: sb.Utils.tag.trim `
						Current price of ${detail.item.name}: ${current.price},
						current trend: ${today.trend} (${today.price})
						${wiki}
					`
				};
			}
	
			case "stats":
			case "seasonal-stats": {
				const user = args.join(" ");
				if (!user) {
					return {
						success: false,
						reply: `No player name provided!`
					};
				}
	
				const data = (command.includes("seasonal"))
					? await this.staticData.fetch(user, { seasonal: true })
					: await this.staticData.fetch(user);
	
				if (data.success === false) {
					return data;
				}
	
				const accountType = (command.includes("seasonal"))
					? "seasonal user"
					: this.staticData.getIronman(data);
	
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
						reply: `${sb.Utils.capitalize(accountType)} ${user} ${emoji} ${skill.level} (XP: ${sb.Utils.groupDigits(skill.experience)})`
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
					return {
						reply: sb.Utils.tag.trim `
							Stats for ${accountType} ${user}:
							${strings.join(" ")}
						`
					};
				}
			}
	
			case "kc":
			case "seasonal-kc": {
				const input = { username: null, activity: null };
				const [first, second] = args.join(" ").toLowerCase().split(",").map(i => i.trim());
	
				if (this.staticData.activities.includes(first)) {
					input.activity = first;
					input.username = second;
				}
				else if (this.staticData.activityAliases[first]) {
					input.activity = this.staticData.activityAliases[first];
					input.username = second;
				}
				else if (this.staticData.activities.includes(second)) {
					input.username = first;
					input.activity = second;
				}
				else if (this.staticData.activityAliases[second]) {
					input.username = first;
					input.activity = this.staticData.activityAliases[second];
				}
				else {
					return {
						success: false,
						reply: `Could not match any activity! Check the list here: https://supinic.com/bot/command/${this.ID}`
					};
				}
	
				const data = (command.includes("seasonal"))
					? await this.staticData.fetch(input.username, { seasonal: true })
					: await this.staticData.fetch(input.username);
	
				if (data.success === false) {
					return data;
				}
	
				const activities = data.activities.map(i => i.name.toLowerCase());
				const bestMatch = sb.Utils.selectClosestString(input.activity, activities, { ignoreCase: true });
				if (!bestMatch) {
					return {
						success: false,
						reply: `Activity was not found! Check the list here: https://supinic.com/bot/command/${this.ID}`
					};
				}
	
				const { name, rank, value } = data.activities.find(i => i.name.toLowerCase() === bestMatch.toLowerCase());
				const ironman = (command.includes("seasonal"))
					? "Seasonal user"
					: sb.Utils.capitalize(this.staticData.getIronman(data));
	
				return {
					reply: (rank === null)
						? `${ironman} ${input.username} is not ranked for ${name}.`
						: `${ironman} ${input.username}'s KC for ${name}: ${value} - rank #${rank}.`
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
		const list = [...activities, ...Object.keys(activityAliases)]
			.sort()
			.map(i => `<li>${i}</li>`)
			.join("");
	
		return [
			"Various utility commands all related to Old School Runescape.",
			"",
	
			"<u>Skill level overview</u>",
			`<code>${prefix}osrs (username)</code>`,
			`<code>${prefix}osrs stats (username)</code>`,
			`<code>${prefix}osrs seasonal-stats (username)</code>`,
			"Posts a full list of skill levels for provided user. Does not include experience or rankings.",
			`If used with "seasonal-stats", the command will attempt to use that user's seasonal profile.`,
			"",
	
			"<u>Skill level detail</u>",
			`<code>${prefix}osrs (username) skill:(skill)</code>`,
			`<code>${prefix}osrs stats (username) skill:(skill)</code>`,
			`<code>${prefix}osrs seasonal-stats (username) skill:(skill)</code>`,
			"For given user, posts the skill's level, experience, and ranking.",
			`If used with "seasonal-stats", the command will attempt to use that user's seasonal profile.`,
			"",
	
			"<u>Kill-count</u>",
			`<code>${prefix}osrs kc (activity), (username)</code>`,
			`<code>${prefix}osrs kc (username), (activity)</code>`,
			`<code>${prefix}osrs seasonal-kc (username), (activity)</code>`,
			`<code>${prefix}osrs seasonal-kc (activity), (username)</code>`,
			"For given user and activity, prints their kill-count and ranking.",
			`If used with "seasonal-kc", the command will attempt to use that user's seasonal profile.`,
			"<b>Important</b>: the name and activity (regardless of order) MUST be separated by a comma!",
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
		]
	})
};