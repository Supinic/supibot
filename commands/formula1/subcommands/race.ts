import { SupiDate } from "supi-core";
import type { FormulaOneSubcommandDefinition } from "../index.js";
import {
	fetchRace,
	fetchNextRaceDetail,
	fetchQualifyingResults,
	fetchRaceResults,
	getHighlights
} from "../f1-api.js";

export default {
	name: "race",
	title: "Race details",
	aliases: [],
	default: true,
	description: [
		`<code>$f1</code>`,
		"Posts quick info about the closest upcoming race in the current season.",
		"If the season is over, will try to find the date for the next season's first race.",
		"",

		`<code>$f1 race (name)</code>`,
		`<code>$f1 race emilia romagna</code>`,
		`<code>$f1 race (country)</code>`,
		`<code>$f1 race monaco</code>`,
		`<code>$f1 race (circuit)</code>`,
		`<code>$f1 race zanddvoort</code>`,
		`<code>$f1 season:1990 race (name)</code>`,
		`<code>$f1 year:1990 race (name)</code>`,
		"Searches for info about a race given by its name or country.",
		"Use <code>season</code> or <code>year</code> to select a season, otherwise defaults to current year."
	],
	execute: async (context, type, ...rest) => {
		if (rest.length === 0) {
			return await fetchNextRaceDetail(context);
		}

		const now = new SupiDate();
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
			? new SupiDate(`${race.date} ${race.time}`)
			: new SupiDate(race.date);

		const delta = core.Utils.timeDelta(raceDate);
		const afterRaceDate = raceDate.clone().addHours(3);

		const data = {
			delta: "",
			pole: "",
			podium: "",
			highlight: "",
			wiki: ""
		};

		if (now > afterRaceDate) {
			const [qualiResults, raceResults, highlights] = await Promise.all([
				fetchQualifyingResults(Number(race.season), Number(race.round)),
				fetchRaceResults(Number(race.season), Number(race.round)),
				getHighlights(race)
			]);

			const pole = qualiResults.at(0);
			if (pole) {
				const driver = `${pole.Driver.givenName.at(0)}. ${pole.Driver.familyName}`;
				const time = pole.Q3 ?? pole.Q2 ?? pole.Q1;
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
			reply: core.Utils.tag.trim `
				Season ${race.season},
				round ${race.round}:
				${race.raceName}.
				
				${data.delta} 				
				${data.pole}
				${data.podium}
				${data.highlight}			
				${data.wiki}
			`
		};
	}
} satisfies FormulaOneSubcommandDefinition;
