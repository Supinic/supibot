const { fetchWorldsData } = require("./utils.js");

/**
 * Each star tier lasts 7 minutes flat after the latest update on 2023-10-25:
 * - `Crashed stars now consistently deplete at a rate of 7 minutes for each layer it has.`
 * - {@link https://oldschool.runescape.wiki/w/Update:Forestry:_Part_Two#Shooting_Stars}
 */
const TIME_PER_TIER = 420_000;

const getRemaining = (star) => {
	const fullTime = TIME_PER_TIER * (star.tier - 1);
	const elapsedTime = sb.Date.now() - (star.calledAt * 1000);
	return (fullTime - elapsedTime);
};
const formatStar = (star, worldsData) => {
	const world = worldsData[star.world];
	const activityString = (world.activity) ? ` (${world.activity})` : "";
	const delta = sb.Utils.formatTime(star.remains / 1000, true);

	return `${world.flagEmoji} W${star.world}${activityString}: T${star.tier} ${star.calledLocation} (${delta})`;
};

module.exports = {
	name: "stars",
	title: "Shooting Stars",
	aliases: ["star"],
	description: [
		"<u>Shooting Stars</u>",
		`<code>$osrs stars</code>`,
		`<code>$osrs star</code>`,
		`Posts a couple of "best" (heuristically selected) worlds with a currently active Shooting star!`,
		`Powered by the <a href="https://map.starminers.site/">Starminers API</a>.`
	],
	execute: async function () {
		const response = await sb.Got("GenericAPI", {
			url: "https://map.starminers.site/data2",
			searchParams: {
				timestamp: sb.Date.now()
			}
		});

		const worlds = await fetchWorldsData();
		const stars = response.body
			.filter(i => worlds[i.world].type !== "free")
			.map(i => ({ ...i, remains: getRemaining(i) }))
			.sort((a, b) => b.remains - a.remains);

		const bestStars = stars.slice(0, 3);
		const string = bestStars.map(i => formatStar(i, worlds)).join("; ");
		return {
			reply: `Top 3 stars: ${string}`
		};
	}
};
