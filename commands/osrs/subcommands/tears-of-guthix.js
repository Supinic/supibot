const flagEmojis = {
	Australia: "🇦🇺",
	Germany: "🇩🇪",
	"United Kingdom": "🇬🇧",
	"United States": "🇺🇸"
};

const fetchWorldLocations = async function () {
	let data = await sb.Cache.getByPrefix("osrs-worlds-data");
	if (!data) {
		const response = await sb.Got("FakeAgent", {
			url: "https://oldschool.runescape.com/slu",
			responseType: "text"
		});

		if (!response.ok) {
			return null;
		}

		const $ = sb.Utils.cheerio(response.body);
		const rows = $("tr.server-list__row");
		const worlds = {};

		for (const row of rows) {
			const [idElement] = $("td > a", row);
			const [countryElement] = $("td.server-list__row-cell--country", row);
			if (!idElement || !countryElement) {
				continue;
			}

			const id = idElement.attribs.id.split("-").at(-1);
			const country = $(countryElement).text();

			worlds[id] = {
				country,
				flagEmoji: flagEmojis[country]
			};
		}

		data = worlds;
		await sb.Cache.setByPrefix("osrs-worlds-data", data, {
			expiry: 864e5 // 1 day
		});
	}

	return data;
};

module.exports = {
	name: "guthix",
	title: "Tears of Guthix",
	aliases: ["tears", "tog"],
	description: [
		"<u>Tears of Guthix</u>",
		`<code>$osrs tog</code>`,
		`<code>$osrs tears</code>`,
		`<code>$osrs guthix</code>`,
		`Posts the list of "ideal" worlds for Tears of Guthix.`,
		`Powered by <a href="https://github.com/jcarbelbide/tog-crowdsourcing-server">Tears of Guthix Crowdsourcing API</a>.`
	],
	execute: async function () {
		const response = await sb.Got("GenericAPI", {
			url: "https://www.togcrowdsourcing.com/worldinfo"
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `The Crowdsourcing API failed! Try again later.`
			};
		}

		const worlds = response.body;
		if (!Array.isArray(worlds) || worlds.length === 0) {
			return {
				success: false,
				reply: `No crowdsourced data is currently available! Try again later.`
			};
		}

		let string;
		const worldsData = await fetchWorldLocations();
		const idealWorlds = worlds
			.filter(i => i.stream_order === "gggbbb")
			.sort((a, b) => b.hits - a.hits);

		if (worldsData) {
			string = idealWorlds.map(i => {
				const country = worldsData[i.world_number];
				const emoji = country?.flagEmoji ?? "";

				return `${emoji} W${i.world_number} (${i.hits} votes)`;
			}).join(", ");
		}
		else {
			string = idealWorlds.map(i => `W${i.world_number} (${i.hits} hits)`).join(", ");
		}

		return {
			reply: `Ideal Tears of Guthix worlds (GGGBBB): ${string}`
		};
	}
};
