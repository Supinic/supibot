module.exports = {
	Name: "formula1",
	Aliases: ["f1"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Aggregate command about anything regarding Formula 1.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "season", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		const url = "https://ergast.com/api/f1/";
		const fetchRace = async (year, searchType, searchValue) => {
			const response = await sb.Got("GenericAPI", `${url}${year}.json`);
			const races = response.body.MRData?.RaceTable?.Races ?? [];
			if (races.length === 0) {
				return {
					success: false,
					reply: `This season has no races!`
				};
			}

			if (searchType === "current") {
				const now = new sb.Date();
				let resultRace;

				for (const race of races) {
					const raceDate = (race.time)
						? new sb.Date(`${race.date} ${race.time}`)
						: new sb.Date(race.date);

					if (now < raceDate) {
						resultRace = race;
						break;
					}
				}

				return resultRace ?? null;
			}
			else if (searchType === "index") {
				const race = races.find(i => Number(i.round) === searchValue);
				return race ?? null;
			}
			else if (searchType === "name") {
				let resultRace;
				const lower = searchValue.toLowerCase();

				for (const race of races) {
					const raceName = race.raceName.toLowerCase();
					const circuitName = race.Circuit.circuitName.toLowerCase();
					const location = race.Circuit.Location.locality.toLowerCase();
					const country = race.Circuit.Location.country.toLowerCase();

					if (raceName.includes(lower) || circuitName.includes(lower) || location.includes(lower) || country.includes(lower)) {
						resultRace = race;
						break;
					}
				}

				return resultRace ?? null;
			}
			else {
				throw new sb.Error({
					message: "Invalid search type provided",
					args: { searchType, searchValue }
				});
			}
		};
		const fetchQualifyingResults = async (year, round) => {
			const response = await sb.Got("GenericAPI", `${url}${year}/${round}/qualifying.json`);
			return response.body.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
		};
		const fetchRaceResults = async (year, round) => {
			const response = await sb.Got("GenericAPI", `${url}${year}/${round}/results.json`);
			return response.body.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
		};
		const fetchNextRaceDetail = async () => {
			const year = new sb.Date().year;
			const race = await fetchRace(year, "current");
			if (!race) {
				return {
					success: false,
					reply: `No next race is currently scheduled!`
				};
			}

			const date = new sb.Date(`${race.date} ${race.time}`);
			const delta = sb.Utils.timeDelta(date);
			return {
				reply: sb.Utils.tag.trim `
					Next race:
					Round ${race.round} - ${race.raceName},
					scheduled ${delta}.
					${race.url}					
				`
			};
		};
		const fetchDriverStandings = async (year) => {
			const response = await sb.Got("GenericAPI", `${url}${year}/driverStandings.json`);
			return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
		};
		const fetchConstructorStandings = async (year) => {
			const response = await sb.Got("GenericAPI", `${url}${year}/constructorStandings.json`);
			return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
		};

		return {
			url,
			fetchDriverStandings,
			fetchConstructorStandings,
			fetchRace,
			fetchQualifyingResults,
			fetchRaceResults,
			fetchNextRaceDetail
		};
	}),
	Code: (async function formula1 (context, ...args) {
		const {
			fetchDriverStandings,
			fetchConstructorStandings,
			fetchRace,
			fetchQualifyingResults,
			fetchRaceResults,
			fetchNextRaceDetail
		} = this.staticData;

		const now = new sb.Date();

		if (args.length === 0) {
			return await fetchNextRaceDetail();
		}

		const type = args[0].toLowerCase();
		const rest = args.slice(1);

		switch (type) {
			case "race": {
				if (rest.length === 0) {
					return await fetchNextRaceDetail();
				}

				const year = context.params.season ?? now.year;
				const query = rest.join(" ").toLowerCase();
				const race = await fetchRace(year, "name", query);
				if (!race) {
					return {
						success: false,
						reply: `No such race exists!`
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
				const year = context.params.season ?? now.year;
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
				const year = context.params.season ?? now.year;
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

			default: {
				return {
					success: false,
					reply: `Invalid sub-command provided! Check help for more info.`
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"All things F1-related in a single command!",
		`Powered by <a href="https://ergast.com/mrd/">Ergas Developer API</a>`,
		`"If you have any suggestions or addition ideas or anything, make sure to let me know via the <a href="https://supinic.com/bot/command/detail/suggest">$suggest</a> command!`,
		"",

		`<code>${prefix}f1</code>`,
		"Posts quick info about the upcoming race - in the current season.",
		"",

		`<code>${prefix}f1 race (name)</code>`,
		`<code>${prefix}f1 year:1990 race (name)</code>`,
		"Searches for info about a race given by its name or country.",
		"Use <code>season</code> to select a season, otherwise defaults to current year.",
		"",

		`<code>${prefix}f1 wdc</code>`,
		`<code>${prefix}f1 driverStandings</code>`,
		`<code>${prefix}f1 year:1990 driverStandings (name)</code>`,
		"Posts a summary for the season's WDC - driver standings.",
		"",

		`<code>${prefix}f1 wcc</code>`,
		`<code>${prefix}f1 constructorStandings</code>`,
		`<code>${prefix}f1 year:1990 constructorStandings (name)</code>`,
		"Posts a summary for the season's WCC - constructor standings.",
		""
	])
};
