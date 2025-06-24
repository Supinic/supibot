import { SupiDate } from "supi-core";
import type { FormulaOneSubcommandDefinition } from "../index.js";
import { fetchConstructorStandings } from "../f1-api.js";

export default {
	name: "constructorStandings",
	aliases: ["wcc"],
	title: "WCC standings",
	default: false,
	description: [
		`<code>$f1 wcc</code>`,
		`<code>$f1 constructorStandings</code>`,
		`<code>$f1 season:1990 wcc</code>`,
		`<code>$f1 year:1990 wcc</code>`,
		"Posts a summary for the season's WCC - constructor standings."
	],
	execute: async (context) => {
		const year = context.params.season ?? context.params.year ?? new SupiDate().year;
		const standings = await fetchConstructorStandings(year);
		if (standings.length === 0) {
			return {
				success: false,
				reply: `That season has no WCC data!`
			};
		}

		const string = standings
			.map(i => `#${i.position}: ${i.Constructor.name} (${i.points})`)
			.join(" ");

		return {
			success: true,
			reply: `Constructor standings for season ${year}: ${string}`
		};
	}
} satisfies FormulaOneSubcommandDefinition;
