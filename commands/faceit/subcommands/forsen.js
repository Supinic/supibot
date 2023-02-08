const forsenUserID = "ea1864f6-5748-41e1-a084-1e5c0044322d";
const lossStreakMemeThreshold = 3;
const lossEmotes = ["forsenClown", "forsenFITTA", "forsenSWA", "forsenInsane", "forsenLaughingAtYou", "forsenLookingAtYou"];
const regularEmotes = ["forsenE", "forsenGaGun", "forsenOkay", "forsenGun"];

const hasForsenWon = (gameData) => {
	const winningTeam = gameData.results.winner;
	const winningPlayerIDs = gameData.teams[winningTeam].players.map(i => i.player_id);

	return winningPlayerIDs.includes(forsenUserID);
};

module.exports = {
	name: "forsen",
	aliases: [],
	getDescription: (prefix) => [
		`<code>${prefix}faceit forsen</code>`,
		"Checks how many matches Forsen has won (surely) or lost (PepeLaugh) in a row."
	],
	execute: async (context) => {
		const response = await sb.Got("GenericAPI", {
			url: `https://open.faceit.com/data/v4/players/${forsenUserID}/history`,
			searchParams: {
				limit: "20"
			},
			headers: {
				Authorization: `Bearer ${sb.Config.get("FACEIT_API_KEY")}`
			}
		});

		const history = response.body.items;
		if (history.length === 0) {
			return {
				success: false,
				reply: `No matches played recently!`
			};
		}

		let previous;
		let lossStreak = 0;
		let lossStreakStopped = false;
		const results = { won: 0, lost: 0 };

		for (const gameData of history) {
			const result = hasForsenWon(gameData);
			if (!result && !previous && !lossStreakStopped) {
				lossStreak++;
			}
			else if (result) {
				lossStreakStopped = true;
			}

			if (result) {
				results.won++;
			}
			else {
				results.lost++;
			}

			previous = result;
		}

		if (lossStreak > lossStreakMemeThreshold) {
			const emote = await context.getBestAvailableEmote(lossEmotes, "😡", { shuffle: true });
			return {
				reply: `Sebastian "Forsen" Fors ${emote} Lost ${lossStreak} games in a row.`
			};
		}
		else {
			const emote = await context.getBestAvailableEmote(regularEmotes, "😎", { shuffle: true });
			return {
				reply: `Forsen's score for the past 20 games ${emote} ${results.won}:${results.lost}`
			};
		}
	}
};
