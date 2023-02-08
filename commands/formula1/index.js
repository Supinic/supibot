module.exports = {
	Name: "formula1",
	Aliases: ["f1"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "Aggregate command about anything regarding Formula 1.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "season", type: "number" },
		{ name: "year", type: "number" },
		{ name: "weather", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		pastaRepeatThreshold: 5
	})),
	Code: (async function formula1 (context, ...args) {
		const {
			fetchDriverStandings,
			fetchConstructorStandings,
			fetchRace,
			fetchQualifyingResults,
			fetchRaceResults,
			fetchNextRaceDetail
		} = require("./api-wrapper.js");

		const now = new sb.Date();

		if (args.length === 0) {
			return await fetchNextRaceDetail(context);
		}

		const type = args[0].toLowerCase();
		const rest = args.slice(1);

		switch (type) {
			case "race": {
				if (rest.length === 0) {
					return await fetchNextRaceDetail(context);
				}

				const year = context.params.season ?? context.params.year ?? now.year;
				const query = rest.join(" ").toLowerCase();
				const race = await fetchRace(year, "name", query);
				if (!race) {
					return {
						success: false,
						reply: `No such F1 race exists!`
					};
				}

				const raceDate = (race.time)
					? new sb.Date(`${race.date} ${race.time}`)
					: new sb.Date(race.date);

				const delta = sb.Utils.timeDelta(raceDate);

				const afterRaceDate = raceDate.clone().addHours(3);

				const data = {};
				if (now > afterRaceDate) {
					const [qualiResults, raceResults, highlights] = await Promise.all([
						fetchQualifyingResults(race.season, race.round),
						fetchRaceResults(race.season, race.round),
						sb.Utils.searchYoutube(
							`${race.season} ${race.raceName} highlights formula 1`,
							sb.Config.get("API_GOOGLE_YOUTUBE")
						)
					]);

					const pole = qualiResults[0];
					if (pole) {
						const driver = `${pole.Driver.givenName.at(0)}. ${pole.Driver.familyName}`;
						const time = pole.Q3 ?? pole.Q2 ?? pole.Q1 ?? "";
						const constructor = pole.Constructor.name;

						data.pole = `Pole position: ${driver} (${constructor}) ${time}`;
					}

					if (raceResults.length !== 0) {
						const podium = raceResults.slice(0, 3).map(i => {
							const driver = `${i.Driver.givenName.at(0)}. ${i.Driver.familyName}`;
							const constructor = i.Constructor.name;

							return `#${i.position}: ${driver} (${constructor})`;
						}).join("; ");

						data.podium = `Podium: ${podium}`;
					}

					if (highlights.length !== 0) {
						const relevantHighlight = highlights.find(i => (
							i.title.includes(race.season) && i.title.toLowerCase().includes(race.raceName.toLowerCase())
						));

						if (relevantHighlight) {
							data.highlight = `Highlights: https://youtu.be/${relevantHighlight.ID}`;
						}
					}

					data.wiki = `Wiki: ${race.url}`;
				}
				else {
					data.delta = `Takes place ${delta}.`;
				}

				return {
					reply: sb.Utils.tag.trim `
						Season ${race.season},
						round ${race.round}:
						${race.raceName}.
						${data.delta ?? ""}						
						${data.pole ?? ""}
						${data.podium ?? ""}		
						${data.highlight ?? ""}				
						${data.wiki ?? ""}	
					`
				};
			}

			case "wdc":
			case "driverStandings": {
				const year = context.params.season ?? context.params.year ?? now.year;
				const standings = await fetchDriverStandings(year);
				if (standings.length === 0) {
					return {
						success: false,
						reply: `That season has no WDC data!`
					};
				}

				const string = standings.map(i => `#${i.position}: ${i.Driver.code ?? i.Driver.familyName} (${i.points})`).join(" ");
				return {
					reply: `Driver standings for season ${year}: ${string}`
				};
			}

			case "wcc":
			case "constructorStandings": {
				const year = context.params.season ?? context.params.year ?? now.year;
				const standings = await fetchConstructorStandings(year);
				if (standings.length === 0) {
					return {
						success: false,
						reply: `That season has no WCC data!`
					};
				}

				const string = standings.map(i => `#${i.position}: ${i.Constructor.name} (${i.points})`).join(" ");
				return {
					reply: `Constructor standings for season ${year}: ${string}`
				};
			}

			case "copypasta": {
				const channelID = context.channel?.ID ?? "whispers";
				this.data.repeatedPastas ??= {};
				this.data.repeatedPastas[channelID] ??= [];

				const pastas = require("./copypasta.json");
				const availablePastas = pastas.filter(i => !this.data.repeatedPastas[channelID].includes(i));

				const pasta = sb.Utils.randArray(availablePastas);
				this.data.repeatedPastas[channelID].unshift(pasta);
				this.data.repeatedPastas[channelID].splice(this.staticData.pastaRepeatThreshold);

				return {
					reply: pasta
				};
			}

			case "gimi":
			case "kimi": {
				const channelID = context.channel?.ID ?? "whispers";
				this.data.repeatedGimi ??= {};
				this.data.repeatedGimi[channelID] ??= [];

				const quotes = require("./kimi.json");
				const availableQuotes = quotes.filter(i => !this.data.repeatedGimi[channelID].includes(i));

				const quote = sb.Utils.randArray(availableQuotes);
				this.data.repeatedGimi[channelID].unshift(quote);
				this.data.repeatedGimi[channelID].splice(this.staticData.pastaRepeatThreshold);

				return {
					reply: quote
				};
			}

			default: {
				return {
					success: false,
					reply: `Invalid sub-command provided! Check help for more info.`
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"All things F1-related in a single command.",
		`Powered by <a href="https://ergast.com/mrd/">Ergast Developer API</a>`,
		`If you have any suggestions, addition ideas or anything else, make sure to let me know via the <a href="https://supinic.com/bot/command/detail/suggest">$suggest</a> command!`,
		"",

		`<code>${prefix}f1</code>`,
		"Posts quick info about the upcoming race - in the current season.",
		"",

		`<code>${prefix}f1 race (name)</code>`,
		`<code>${prefix}f1 race (country)</code>`,
		`<code>${prefix}f1 race (circuit)</code>`,
		`<code>${prefix}f1 season:1990 race (name)</code>`,
		`<code>${prefix}f1 year:1990 race (name)</code>`,
		"Searches for info about a race given by its name or country.",
		"Use <code>season</code> to select a season, otherwise defaults to current year.",
		"",

		`<code>${prefix}f1 driverStandings</code>`,
		`<code>${prefix}f1 wdc</code>`,
		`<code>${prefix}f1 season:1990 wdc</code>`,
		`<code>${prefix}f1 year:1990 wdc</code>`,
		"Posts a summary for the season's WDC - driver standings.",
		"",

		`<code>${prefix}f1 wcc</code>`,
		`<code>${prefix}f1 constructorStandings</code>`,
		`<code>${prefix}f1 season:1990 wcc</code>`,
		`<code>${prefix}f1 year:1990 wcc</code>`,
		"Posts a summary for the season's WCC - constructor standings.",
		"",

		`<code>${prefix}f1 copypasta</code>`,
		"Posts a random F1 related copypasta.",
		"",

		`<code>${prefix}f1 gimi</code>`,
		"Posts a random Kimi Räikkönen quote or radio comms.",
		""
	])
};
