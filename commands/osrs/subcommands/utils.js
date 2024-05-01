const flagEmojis = {
	Australia: "🇦🇺",
	Germany: "🇩🇪",
	"United Kingdom": "🇬🇧",
	"United States": "🇺🇸"
};

const fetchWorldsData = async function () {
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
			// eslint-disable-next-line no-unused-vars
			const [idEl, playersEl, countryEl, typeEl, activityEl] = $("td", row);
			const id = $("a", idEl)[0]?.attribs.id.split("-").at(-1);
			if (!id) {
				continue;
			}

			const country = $(countryEl).text();
			const type = $(typeEl).text().toLowerCase();
			const activity = $(activityEl).text();

			worlds[id] = {
				country,
				type,
				activity: (activity !== "-") ? activity : null,
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
	flagEmojis,
	fetchWorldsData
};
