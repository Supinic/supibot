const { searchYoutube } = require("../../utils/command-utils.js");
const { getLinkParser } = require("../../utils/link-parser.js");

const RESULTS_PER_SEARCH = 25;
const DAILY_SEARCHES_CAP = 2000;

const getClosestPacificMidnight = () => {
	const now = new sb.Date().discardTimeUnits("m", "s", "ms");
	const result = now.clone().discardTimeUnits("h").addHours(9);
	if (now.hours >= 9) {
		result.addDays(1);
	}

	return result;
};

module.exports = {
	Name: "youtubesearch",
	Aliases: ["ys"],
	Author: "supinic",
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

		let searchAmountToday = await this.getCacheData("search-amount-today");
		let cacheRecordExists = true;
		if (!searchAmountToday) {
			cacheRecordExists = false;
			searchAmountToday = 0;
		}

		searchAmountToday++;

		if (searchAmountToday >= DAILY_SEARCHES_CAP) {
			const when = sb.Utils.timeDelta(getClosestPacificMidnight());
			return {
				success: false,
				reply: `No more YouTube searches available today! Reset happens at midnight Pacific Time, which is ${when}.`
			};
		}

		const index = context.params.index ?? 0;
		if (!sb.Utils.isValidInteger(index)) {
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
		const LinkParser = getLinkParser();
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
			const tracks = await searchYoutube(
				query,
				/** @type {string} */
				sb.Config.get("API_GOOGLE_YOUTUBE"),
				{
					maxResults: RESULTS_PER_SEARCH
				}
			);

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

			const track = tracks[index];
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
		}

		const published = new sb.Date(data.created).format("Y-m-d");
		const durationString = (data.duration === null)
			? ""
			: `Duration: ${sb.Utils.formatTime(data.duration, true)}`;

		return {
			reply: sb.Utils.tag.trim `
				"${data.name}"
				by ${data.author},
				${sb.Utils.groupDigits(data.views)} views,
				published on ${published}.
				${durationString}
				${data.link}
			`
		};
	}),
	Dynamic_Description: null
};
