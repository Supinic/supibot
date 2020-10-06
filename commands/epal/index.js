module.exports = {
	Name: "epal",
	Aliases: ["ForeverAlone"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random person from epal.gg - post their description. If used on supinic's channel with TTS on, and if they have an audio introduction, it will be played on stream.",
	Flags: ["mention"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		fetchGamesData: async () => {
			const data = await sb.Got.instances.FakeAgent({
				method: "POST",
				url: "https://www.egirl.gg/api/web/product-type/list-by-game?"
			}).json();
	
			return JSON.stringify(data.content.map(i => ({
				ID: i.id,
				name: i.nameEn,
				gameID: i.gameNum
			})).sort((a, b) => a.ID - b.ID), null, 4);
		},
	
		games: [
			{
				"ID": 1,
				"name": "CS:GO",
				"gameID": 2102
			},
			{
				"ID": 2,
				"name": "Dota 2",
				"gameID": 295
			},
			{
				"ID": 3,
				"name": "PUBG",
				"gameID": 139
			},
			{
				"ID": 4,
				"name": "League of Legends",
				"gameID": 9855
			},
			{
				"ID": 5,
				"name": "Fortnite",
				"gameID": 1909
			},
			{
				"ID": 6,
				"name": "Minecraft",
				"gameID": 2345
			},
			{
				"ID": 7,
				"name": "Overwatch",
				"gameID": 2467
			},
			{
				"ID": 8,
				"name": "Hearthstone",
				"gameID": 153
			},
			{
				"ID": 9,
				"name": "Gwent",
				"gameID": 16
			},
			{
				"ID": 10,
				"name": "Heroes of the Storm",
				"gameID": 125
			},
			{
				"ID": 11,
				"name": "World of Warcraft",
				"gameID": 499
			},
			{
				"ID": 12,
				"name": "Apex Legends",
				"gameID": 905
			},
			{
				"ID": 13,
				"name": "VR Chat",
				"gameID": 543
			},
			{
				"ID": 14,
				"name": "Dead by Daylight",
				"gameID": 621
			},
			{
				"ID": 15,
				"name": "Rocket League",
				"gameID": 372
			},
			{
				"ID": 16,
				"name": "Super Smash bros",
				"gameID": 272
			},
			{
				"ID": 17,
				"name": "Roblox",
				"gameID": 509
			},
			{
				"ID": 18,
				"name": "Call of Duty",
				"gameID": 1210
			},
			{
				"ID": 19,
				"name": "Animal Crossing: New Horizons",
				"gameID": 668
			},
			{
				"ID": 20,
				"name": "Rainbow Six",
				"gameID": 681
			},
			{
				"ID": 21,
				"name": "Grand Theft Auto V",
				"gameID": 148
			},
			{
				"ID": 22,
				"name": "Osu!",
				"gameID": 449
			},
			{
				"ID": 23,
				"name": "Destiny 2",
				"gameID": 170
			},
			{
				"ID": 24,
				"name": "Pokémon Sword/Shield",
				"gameID": 65
			},
			{
				"ID": 25,
				"name": "Monster Hunter World",
				"gameID": 179
			},
			{
				"ID": 26,
				"name": "Final Fantasy XIV Online",
				"gameID": 142
			},
			{
				"ID": 27,
				"name": "Borderlands 3",
				"gameID": 82
			},
			{
				"ID": 28,
				"name": "Black Desert Online",
				"gameID": 100
			},
			{
				"ID": 29,
				"name": "Legends of Runeterra",
				"gameID": 40
			},
			{
				"ID": 30,
				"name": "Escape From Tarkov",
				"gameID": 145
			},
			{
				"ID": 31,
				"name": "Slither io",
				"gameID": 190
			},
			{
				"ID": 33,
				"name": "PUBG: Mobile",
				"gameID": 32
			},
			{
				"ID": 34,
				"name": "Call of Duty®: Mobile - Garena",
				"gameID": 57
			},
			{
				"ID": 35,
				"name": "Arena of Valor",
				"gameID": 8
			},
			{
				"ID": 36,
				"name": "Minecraft: Mobile",
				"gameID": 19
			},
			{
				"ID": 37,
				"name": "Fortnite: Mobile",
				"gameID": 18
			},
			{
				"ID": 38,
				"name": "Roblox: Mobile",
				"gameID": 22
			},
			{
				"ID": 40,
				"name": "Teamfight Tactics",
				"gameID": 102
			},
			{
				"ID": 41,
				"name": "E-Chat",
				"gameID": 193
			},
			{
				"ID": 42,
				"name": "Smite",
				"gameID": 26
			},
			{
				"ID": 43,
				"name": "Valorant",
				"gameID": 166
			}
		]
	})),
	Code: (async function epal (context, ...args) {
		let game = sb.Utils.randArray(this.staticData.games);
		let selectedSex = "1";
	
		for (const token of args) {
			if (token.includes("game:")) {
				const name = token.replace("game:", "").toLowerCase();
				game = this.staticData.games.find(i => i.name.toLowerCase().includes(name));
	
				if (!game) {
					return {
						reply: "Could not match your provided game!"
					};
				}
			}
			else if (token.includes("gender:") || token.includes("sex:")) {
				const gender = token.replace("gender:", "").replace("sex:", "").toLowerCase();
				if (gender === "male") {
					selectedSex = "0";
				}
				else if (gender === "female") {
					selectedSex = "1";
				}
				else {
					return {
						reply: "Could not match your provided gender!"
					};
				}
			}
		}
	
		const { statusCode, body: data } = await sb.Got.instances.FakeAgent({
			method: "POST",
			throwHttpErrors: false,
			responseType: "json",
			url: "https://play.epal.gg/web/home/might_like",
			json: {
				ps: 1,
				productTypeId: String(game.ID),
				sex: selectedSex
			}
		});
	
		if (statusCode !== 200) {
			throw new sb.errors.APIError({
				apiName: "EgirlAPI",
				statusCode
			});
		}
	
		if (!data.content || data.content.length === 0) {
			return {
				success: false,
				reply: "No eligible profiles found!"
			};
		}
	
		const ttsData = sb.Command.get("tts").data;
		const {
			serveNum,
			recommendNum,
			userName,
			sex,
			languageName,
			introductionText,
			introductionSpeech,
			price
		} = data.content[0];
	
		if (context.channel?.ID === 38 && sb.Config.get("TTS_ENABLED") && !ttsData.pending) {
			ttsData.pending = true;
	
			await sb.LocalRequest.playSpecialAudio({
				url: introductionSpeech,
				volume: sb.Config.get("TTS_VOLUME"),
				limit: 20_000
			});
	
			ttsData.pending = false;
		}
	
		let type = "(unspecified)";
		if (sex === 0) {
			type =  "(M)";
		}
		else if (sex === 1) {
			type =  "(F)";
		}
		
		const revenue = (serveNum > 0)
			? `Total revenue: $${(serveNum * price) / 100}`
			: "";
		const language = (languageName)
			? `They speak ${languageName}.`
			: "";
	
		return {
			reply: `${userName} ${type} plays ${game.name} for $${price / 100}: ${introductionText} ${language} ${revenue}`
		};
	}),
	Dynamic_Description: async (prefix, values) => {
		const row = await sb.Query.getRow("chat_data", "Command");
		await row.load(208);
		
		const games = values.getStaticData().games
			.map(i => `<li><code>${i.name}</code></li>`)
			.sort()
			.join("");
	
		return [
			`Fetches a random description of a user profile from <a target="_blank" href="egirl.gg">egirl.gg</a>.`,
			`If this command is executed in Supinic's channel and TTS is on, the user introduction audio will be played.`,
			"",
	
			`<code>${prefix}ForeverAlone</code>`,
			"Random user, female only",
			"",
	
			`<code>${prefix}ForeverAlone sex:(male/female)</code>`,
			"Random user, specified sex only",
			"",
	
			`<code>${prefix}ForeverAlone game:(game)</code>`,
			"Random user, selected game only. Only uses the first word of the game you provide.",
			`List of games: <ul>${games}</ul>`
		];
	}
};