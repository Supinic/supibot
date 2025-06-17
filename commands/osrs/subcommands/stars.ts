import { SupiDate } from "supi-core";
import { bindOsrsSubcommand } from "../index.js";
import { fetchWorldsData, type GameWorlds } from "./osrs-utils.js";

/**
 * Each star tier lasts 7 minutes flat after the latest update on 2023-10-25:
 * - `Crashed stars now consistently deplete at a rate of 7 minutes for each layer it has.`
 * - {@link https://oldschool.runescape.wiki/w/Update:Forestry:_Part_Two#Shooting_Stars}
 */
const TIME_PER_TIER = 420_000;
const activityRegex = /(pvp|high risk|skill total)/i;

type StarData = {
	world: number;
	location: number;
	calledBy: string;
	calledLocation: string;
	calledAt: number;
	minTime: number;
	maxTime: number;
	tier: number;
};
type AdjustedStarData = StarData & {
	remains: number;
};

const getRemaining = (star: StarData) => {
	const fullTime = TIME_PER_TIER * (star.tier - 1);
	const elapsedTime = SupiDate.now() - (star.calledAt * 1000);
	return (fullTime - elapsedTime);
};
const formatStar = (star: AdjustedStarData, worldsData: GameWorlds) => {
	const delta = core.Utils.formatTime(star.remains / 1000, true);
	const world = worldsData[star.world];
	const activityString = (world.activity && activityRegex.test(world.activity))
		? ` (${world.activity})`
		: "";

	return `${world.flagEmoji} W${star.world}${activityString}: T${star.tier} ${star.calledLocation} (${delta})`;
};

export default bindOsrsSubcommand({
	name: "stars",
	title: "Shooting Stars",
	aliases: ["star"],
	default: true,
	description: [
		"<u>Shooting Stars</u>",
		`<code>$osrs stars</code>`,
		`<code>$osrs star</code>`,
		`Posts a couple of "best" (heuristically selected) worlds with a currently active Shooting star!`,
		`Powered by the <a href="https://map.starminers.site/">Starminers API</a>.`
	],
	execute: async function () {
		const response = await core.Got.get("GenericAPI")<StarData[]>({
			url: "https://map.starminers.site/data2",
			searchParams: {
				timestamp: SupiDate.now()
			}
		});

		const worlds = await fetchWorldsData();
		if (!worlds) {
			return {
			    success: false,
			    reply: "OSRS worlds data is currently unavailable! Try again later."
			};
		}

		const stars: AdjustedStarData[] = response.body
			.filter(i => worlds[i.world].type !== "free")
			.map(i => ({ ...i, remains: getRemaining(i) }))
			.sort((a, b) => b.remains - a.remains);

		const bestStars = stars.slice(0, 3);
		const string = bestStars.map(i => formatStar(i, worlds)).join("; ");
		return {
			reply: `Top 3 stars: ${string}`
		};
	}
});
