import { SupiDate, SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

import { searchYoutube } from "../../utils/command-utils.js";
import getLinkParser from "../../utils/link-parser.js";

const RESULTS_PER_SEARCH = 25;
const DAILY_SEARCHES_CAP = 2000;

const getClosestPacificMidnight = () => {
	const now = new SupiDate().discardTimeUnits("m", "s", "ms");
	const result = now.clone().discardTimeUnits("h").addHours(9);
	if (now.hours >= 9) {
		result.addDays(1);
	}

	return result.valueOf();
};

export default declare({
	Name: "youtubesearch",
	Aliases: ["ys"],
	Cooldown: 10000,
	Description: "Searches YouTube for video(s) with your query. Only a certain number of uses are available daily.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "index", type: "number" },
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function youtubeSearch (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No query provided!`,
				cooldown: 5000
			};
		}

		let searchAmountToday = await this.getCacheData("search-amount-today") as number | null;
		let cacheRecordExists = true;
		if (!searchAmountToday) {
			cacheRecordExists = false;
			searchAmountToday = 0;
		}

		searchAmountToday++;

		if (searchAmountToday >= DAILY_SEARCHES_CAP) {
			const when = core.Utils.timeDelta(getClosestPacificMidnight());
			return {
				success: false,
				reply: `No more YouTube searches available today! Reset happens at midnight Pacific Time, which is ${when}.`
			};
		}

		const index = context.params.index ?? 0;
		if (!core.Utils.isValidInteger(index)) {
			return {
				success: false,
				reply: `Provided index must be a valid integer!`
			};
		}
		else if (index > RESULTS_PER_SEARCH) {
			return {
				success: false,
				reply: `Your index must be in the range <0, ${RESULTS_PER_SEARCH}>!`
			};
		}

		let data;
		let videoID;
		const LinkParser = await getLinkParser();
		const youtubeParser = LinkParser.getParser("youtube");

		if (youtubeParser.checkLink(query, false)) {
			videoID = youtubeParser.parseLink(query);
		}
		else if (youtubeParser.checkLink(query, true)) {
			videoID = query;
		}

		if (videoID) {
			data = await youtubeParser.fetchData(videoID);
		}

		if (!data) {
			const tracks = await searchYoutube(query, {
				maxResults: RESULTS_PER_SEARCH,
				filterShortsHeuristic: true
			});

			if (cacheRecordExists) {
				await this.setCacheData("search-amount-today", searchAmountToday, {
					keepTTL: true
				});
			}
			else {
				await this.setCacheData("search-amount-today", searchAmountToday, {
					expiresAt: getClosestPacificMidnight()
				});
			}

			const track = tracks.at(index);
			if (!track) {
				const message = (tracks.length > 0 && typeof context.params.index === "number")
					? `There is no such video for your provided index! Up to ${tracks.length} videos are available.`
					: "No videos found for that query!";

				return {
					success: false,
					reply: message
				};
			}

			const link = `https://youtu.be/${track.ID}`;
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			data = await youtubeParser.fetchData(track.ID);

			if (!data) {
				throw new SupiError({
				    message: "Assert error: YouTube ID found in search but not in fetchData",
					args: { track }
				});
			}
		}

		const published = (data.created) ? new SupiDate(data.created).format("Y-m-d") : "N/A";
		const durationString = (data.duration === null)
			? ""
			: `Duration: ${core.Utils.formatTime(data.duration, true)}`;

		return {
			reply: core.Utils.tag.trim `
				"${data.name}"
				by ${data.author ?? "(N/A)"},
				${core.Utils.groupDigits(data.views ?? 0)} views,
				published on ${published}.
				${durationString}
				${data.link}
			`
		};
	}),
	Dynamic_Description: null
});
