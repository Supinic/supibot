import { fetchDriverStandings } from "../api-wrapper.ts";

export default {
	name: "driverStandings",
	aliases: ["wdc"],
	description: [
		`<code>$f1 driverStandings</code>`,
		`<code>$f1 wdc</code>`,
		`<code>$f1 season:1990 wdc</code>`,
		`<code>$f1 year:1990 wdc</code>`,
		"Posts a summary for the season's WDC - driver standings."
	],
	execute: async (context) => {
		const year = context.params.season ?? context.params.year ?? new sb.Date().year;
		const standings = await fetchDriverStandings(year);
		if (standings.length === 0) {
			return {
				success: false,
				reply: `That season has no WDC data!`
			};
		}

		const string = standings
			.map(i => `#${i.position}: ${i.Driver.code ?? i.Driver.familyName} (${i.points})`)
			.join(" ");

		return {
			reply: `Driver standings for season ${year}: ${string}`
		};
	}
};
