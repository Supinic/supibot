import faceitData from "./faceit-data.json" with { type: "json" };
const { maxPointsPerGame, skillLevelRanges } = faceitData;

export default {
	name: "elo",
	aliases: ["rating"],
	description: [
		`<code>$faceit elo (user)</code>`,
		`<code>$faceit elo s1mple</code>`,
		"Checks the provided user's current rating (elo), level and potential change next game."
	],
	execute: async (context, user) => {
		if (!user) {
			return {
				success: false,
				reply: `No user provided!`
			};
		}

		const response = await sb.Got.get("GenericAPI")({
			url: "https://open.faceit.com/data/v4/players",
			searchParams: {
				nickname: user
			},
			headers: {
				Authorization: `Bearer ${process.env.API_FACEIT_KEY}`
			},
			throwHttpErrors: false
		});

		if (response.statusCode === 404) {
			return {
				success: false,
				reply: `No player found for that name!`
			};
		}

		const userGameData = response.body;
		const gameData = response.body.games?.csgo;
		if (!gameData) {
			return {
				success: false,
				reply: `That player has no CS:GO data on FACEIT!`
			};
		}

		const elo = gameData.faceit_elo;
		const skillLevel = gameData.skill_level;

		const userLevelRange = skillLevelRanges[skillLevel];
		const lowerBound = userLevelRange[0] ?? 0;
		const higherBound = userLevelRange[1] ?? Infinity;

		let levelChangeString = "";
		if (elo + maxPointsPerGame > higherBound) {
			levelChangeString = `That user could be promoted to level ${skillLevel + 1} next game!`;
		}
		else if (elo - maxPointsPerGame < lowerBound) {
			levelChangeString = `That user could be demoted to level ${skillLevel - 1} next game!`;
		}

		const userString = (userGameData.memberships.includes("premium")) ? "premium user" : "user";
		const region = gameData.region;
		return {
			reply: sb.Utils.tag.trim `
				${region}
				${userString} 
				"${userGameData.nickname}"
				(Steam: "${userGameData.steam_nickname}"):
				ELO: ${elo}, 
				current level: ${skillLevel}.
				${levelChangeString}
			`
		};
	}
};
