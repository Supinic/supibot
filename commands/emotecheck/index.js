module.exports = {
	Name: "emotecheck",
	Aliases: ["ec"],
	Author: "supinic",
	Last_Edit: "2020-09-15T17:14:43.000Z",
	Cooldown: 15000,
	Description: "Posts the list of each of Twitch's amazing \"global\" emote sets.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		sets: [
			{
				name: "hyperscape",
				aliases: ["hyper"],
				description: "These emotes are acquired when you or someone else cheers, subs or gifts subs in a channel. Active in August 2020",
				notes: "https://blog.twitch.tv/en/2020/08/11/hyper-scape-launches-celebrate-with-new-features-and-exclusive-emotes/",
				emotes: [
					"HyperCheese",
					"HyperCooldown",
					"HyperCrate",
					"HyperCrown",
					"HyperGravity",
					"HyperHaste",
					"HyperHex",
					"HyperJump",
					"HyperLost",
					"HyperMayhem",
					"HyperMine",
					"HyperParkour",
					"HyperReveal",
					"HyperSlam",
					"HyperTiger"
				]
			},
			{
				name: "pride2020",
				aliases: ["pride"],
				description: "These emotes were randomly made available by watching streams in June 2020",
				emotes: [
					"PrideCrown",
					"PrideCute",
					"PrideDragon",
					"PrideFloat",
					"PrideFlower",
					"PrideHeartL",
					"PrideHeartR",
					"PrideHeyyy",
					"PrideKoala",
					"PrideLGBTea",
					"PrideLaugh",
					"PrideLion",
					"PrideLove",
					"PridePaint",
					"PridePenguin",
					"PridePog",
					"PrideRhino",
					"PrideRise",
					"PrideShrug",
					"PrideStrong",
					"PrideToucan",
					"PrideUnicorn",
					"PrideUwu",
					"PrideWave",
					"PrideWorld"
				]
			},
			{
				name: "pride2019",
				aliases: [],
				description: "These emotes were randomly made available by watching streams in June 2019",
				emotes: [
					"PrideAsexual",
					"PrideBalloons",
					"PrideBisexual",
					"PrideCheers",
					"PrideFlag",
					"PrideGasp",
					"PrideGive",
					"PrideHi",
					"PrideLesbian",
					"PrideLionChomp",
					"PrideLionHey",
					"PrideLionYay",
					"PridePan",
					"PrideParty",
					"PrideSaba",
					"PrideShine",
					"PrideTake",
					"PrideTrans",
					"PrideWingL",
					"PrideWingR"
				]
			},
			{
				name: "haha",
				aliases: [],
				description: "Winter-themed emotes awarded by having someone in chat gift subs or cheers, between 2019-12-03 and 2020-01-03.",
				notes: "https://help.twitch.tv/s/article/happy-hahahalidays",
				emotes: [
					"Haha2020",
					"HahaBaby",
					"HahaBall",
					"HahaCat",
					"HahaDoge",
					"HahaDreidel",
					"HahaElf",
					"HahaGingercat",
					"HahaGoose",
					"HahaHide",
					"HahaLean",
					"HahaNutcracker",
					"HahaNyandeer",
					"HahaPoint",
					"HahaPresent",
					"HahaReindeer",
					"HahaShrugLeft",
					"HahaShrugMiddle",
					"HahaShrugRight",
					"HahaSleep",
					"HahaSnowhal",
					"HahaSweat",
					"HahaThink",
					"HahaThisisfine",
					"HahaTurtledove"
				]
			},
			{
				name: "rpg",
				aliases: [],
				description: "RPG-related emotes awarded by having someone in chat gift subs or cheers, between 2019-10-04 and 2020-10-18.",
				notes: "https://help.twitch.tv/s/article/rpg-megacheer",
				emotes: [
					"RPGAyaya",
					"RPGBukka",
					"RPGBukkaNoo",
					"RPGEmpty",
					"RPGEpicStaff",
					"RPGEpicSword",
					"RPGFei",
					"RPGFireball",
					"RPGGhosto",
					"RPGHP",
					"RPGMana",
					"RPGOops",
					"RPGPhatLoot",
					"RPGSeven",
					"RPGShihu",
					"RPGStaff",
					"RPGTreeNua",
					"RPGYonger"
				]
			},
			{
				name: "fb",
				aliases: ["football"],
				description: "Emotes related to American football, first handed out on 2018-07-16, meant to be temporary, but later became global.",
				notes: "https://blog.twitch.tv/en/2018/06/11/support-streamers-and-get-gifts-by-cheering-for-your-favorite-world-cup-team-c10c455cedcc/",
				emotes: [
					"FBBlock",
					"FBCatch",
					"FBChallenge",
					"FBPass",
					"FBPenalty",
					"FBRun",
					"FBSpiral",
					"FBtouchdown"
				]
			},
			{
				name: "fight",
				aliases: ["food"],
				description: "Emotes related to the subject of \"Food fight\". Handed out between 2019-08-22 and 2019-09-02, when someone cheered or gifted subs. They are no longer available.",
				notes: "https://help.twitch.tv/s/article/megacheer-food-fight",
				emotes: [
					"FightBagel",
					"FightBerry",
					"FightBox",
					"FightBurger",
					"FightCC",
					"FightCake",
					"FightCheese",
					"FightChips",
					"FightCookie",
					"FightCorn",
					"FightCup",
					"FightEgg",
					"FightFruit",
					"FightFry",
					"FightIce",
					"FightJello",
					"FightMash",
					"FightNacho",
					"FightPBJ",
					"FightPC",
					"FightPepper",
					"FightPie",
					"FightPizza",
					"FightPop",
					"FightPudding",
					"FightRamen",
					"FightSalad",
					"FightSardine",
					"FightSmoothie",
					"FightSmore",
					"FightSoda",
					"FightSoup",
					"FightSpag",
					"FightSub",
					"FightTomato"
				]
			},
			{
				name: "kk",
				aliases: ["kkona"],
				description: "KKona-style emotes, mostly available in Supinic's channel on Twitch. Each variation represents a country.",
				emotes: [
					"BBrexit",
					"CCabron",
					"CChile",
					"GGyros",
					"KKarjala",
					"KKebab",
					"KKhan",
					"KKiwi",
					"KKomrade",
					"KKona",
					"KKottbullar",
					"KKozak",
					"KKraut",
					"KKrikey",
					"KKroissant",
					"KKurwa"
				]
			},
			{
				name: "luv",
				aliases: ["valentine"],
				description: "Valentine-themed emotes awarded by having someone in chat gift subs or cheers, handed out between 2020-01-30 and 2020-02-16.",
				notes: "https://help.twitch.tv/s/article/streamer-love",
				emotes: [
					"LuvBlondeL",
					"LuvBlondeR",
					"LuvBlush",
					"LuvBrownL",
					"LuvBrownR",
					"LuvCool",
					"LuvGift",
					"LuvHearts",
					"LuvOops",
					"LuvPeekL",
					"LuvPeekR",
					"LuvSign",
					"LuvSnooze",
					"LuvUok"
				]
			},
			{
				name: "sir",
				aliases: ["2fa"],
				description: "Implemented on 2020-04-02, this emoteset is a reward for having 2FA on your Twitch account.",
				emotes: [
					"SirMad",
					"SirPrise",
					"SirSad",
					"SirShield",
					"SirSword",
					"SirUwU"
				]
			},
			{
				name: "hype",
				aliases: ["hypetrain"],
				description: "Hype Train emotes - obtainable when you participate in a so-called hype train in a channel.",
				emotes: [
					"HypeChimp",
					"HypeGhost",
					"HypeChest",
					"HypeFrog",
					"HypeCherry",
					"HypePeace",
	
					"HypeBug",
					"HypeBrain",
					"HypeZap",
					"HypeShip",
					"HypeSign",
					"HypeSideeye",
	
					"HypeYikes",
					"HypeRacer",
					"HypeCar",
					"HypeFirst",
					"HypeTrophy",
					"HypeBanana",
	
					"HypeBlock",
					"HypeDaze",
					"HypeBounce",
					"HypeJewel",
					"HypeBlobk",
					"HypeTeamwork",
	
					"HypeLove",
					"HypePunk",
					"HypeKO",
					"HypePunch",
					"HypeFire",
					"HypePizza"
				]
			},
			{
				name: "legacyhype",
				aliases: ["oldhype"],
				description: "Legacy Hype Train emotes - no longer available.",
				emotes: [
					"HypeGriffin1",
					"HypeGriffin2",
					"HypeGriffin3",
					"HypeGriffin4",
					"HypeGriffin5",
					"HypeGriffin6",
	
					"HypeBigfoot1",
					"HypeBigfoot2",
					"HypeBigfoot3",
					"HypeBigfoot4",
					"HypeBigfoot5",
					"HypeBigfoot6",
	
					"HypeOni1",
					"HypeOni2",
					"HypeOni3",
					"HypeOni4",
					"HypeOni5",
					"HypeOni6",
	
					"HypeDragon1",
					"HypeDragon2",
					"HypeDragon3",
					"HypeDragon4",
					"HypeDragon5",
					"HypeDragon6",
	
					"HypeUnicorn1",
					"HypeUnicorn2",
					"HypeUnicorn3",
					"HypeUnicorn4",
					"HypeUnicorn5",
					"HypeUnicorn6",
				]
			},
			{
				name: "dankpeepo",
				aliases: [],
				description: "A list of dank peepo emotes.",
				emotes: [
					"peepoGladDank",
					"peepoGreedDank",
					"peepoHmmDank",
					"peepoLagDank",
					"peepoMadDank",
					"peepoNerdDank",
					"peepoSadDank",
					"peepoSadSip",
					"peepoSpookDank",
					"peepoWeirdDank",
					"supiniOkay",
					"supiniThink"
				]
			},
		]
	}),
	Code: (async function emoteCheck (context, name) {
		if (!name) {
			return {
				reply: `Check available emote sets here: https://supinic.com/bot/command/${this.ID}`
			};
		}
	
		name = name.toLowerCase();
		const result = this.staticData.sets.find(i => i.name === name || i.aliases.includes(name));
		if (!result) {
			return {
				reply: `No valid emote set found! Check available emote sets here: https://supinic.com/bot/command/${this.ID}`
			};
		}
		
		return {
			reply: result.emotes.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { sets } = values.getStaticData();
		const list = sets.map(i => {
			const aliases = (i.aliases.length === 0)
				? ""
				: `(${i.aliases.join(", ")})`;
	
			return `<li><code>${i.name} ${aliases}</code><br>${i.description}</li>`;
		}).join("<br>");
		
		return [
			"Posts entire emote sets on Twitch and stuff.",
			"Useful to see if you are missing any of given emotes, or just for convience and/or novelty",
			"",
	
			`<code>${prefix}emotecheck (set name)</code>`,
			"(emotes)",
			"",
	
			`<ul>${list}</ul>`
		];
	})
};