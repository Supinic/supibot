module.exports = {
	Name: "osrs",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-27T17:48:18.000Z",
	Cooldown: 5000,
	Description: "Aggregate command for whatever regarding Old School Runescape.",
	Flags: ["mention","use-params"],
	Whitelist_Response: null,
	Static_Data: ({
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
	}),
	Code: (async function osrs (context, command, ...args) {
		if (!command) {
			return {
				success: false,
				reply: `No command provided!`
			};
		}
	
		switch (command.toLowerCase()) {
			case "price": {
				const query = args.join(" ");
				const data = await sb.Query.getRecordset(rs => rs
					.select("Game_ID", "Name")
					.from("osrs", "Item")
					.where("Name %*like*", query)
				);
	
				if (data.length === 0) {
					return {
						success: false,
						reply: `No items found for given query!`
					};
				}
	
				const bestMatch = sb.Utils.selectClosestString(query, data.map(i => i.Name), { ignoreCase: true });
				const itemID = data.find(i => i.Name.toLowerCase() === bestMatch.toLowerCase()).Game_ID;
				const { statusCode, body: detail } = await sb.Got({
					url: "https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json",
					throwHttpErrors: false,
					responseType: "json",
					searchParams: new sb.URLParams()
						.set("item", itemID)
						.toString()
				});
	
				if (statusCode !== 200) {
					return {
						success: false,
						reply: `Item not found!`
					};
				}
	
				const { current, today } = detail.item;
				return {
					reply: `Current price of ${detail.item.name}: ${current.price}, current trend: ${today.trend} (${today.price})`
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
	
				let data = await sb.Cache.getByPrefix("command-osrs-stats", {
					keys: { user }
				});
				
				if (!data) {
					const apiData = await sb.Got.instances.Supinic("osrs/lookup/" + user).json();
					if (!apiData.data) {
						return {
							success: false,
							reply: `No data found for given player name!`
						};
					}
	
					data = apiData.data;
					await sb.Cache.setByPrefix("command-osrs-stats", data, {
						keys: { user },
						expiry: 600_000
					});
				}
	
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
							reply: `That user's ${context.params.skill.toLowerCase()} is not high enough level to appear on the highscores!`
						};
					}
	
					const { emoji } = this.staticData.skills.find(i => i.name.toLowerCase() === skillName);
					return {
						reply: `${emoji} ${skill.level} (XP: ${sb.Utils.groupDigits(skill.experience)})`
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
						reply: `User ${user} does exist, but none of their stats are being tracked.`
					};
				}
				else {
					return {
						reply: sb.Utils.tag.trim `
							Stats for user ${user}:
							${strings.join(" ")}
						`
					};
				}
			}
	
			default:
				return {
					success: false,
					reply: `Invalid subcommand provided! Check this command's extended help for more info.`
				};
		}
	}),
	Dynamic_Description: null
};