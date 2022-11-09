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
	Static_Data: (() => ({
		indexThreshold: 25,
		threshold: 2000,
		getClosestPacificMidnight: () => {
			const now = new sb.Date().discardTimeUnits("m", "s", "ms");
			const result = now.clone().discardTimeUnits("h").addHours(9);

			if (now.hours >= 9) {
				result.addDays(1);
			}

			return result;
		}
	})),
	Code: (async function youtubeSearch (context, ...args) {
		const { getClosestPacificMidnight, threshold } = this.staticData;
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

		if (searchAmountToday >= threshold) {
			const when = sb.Utils.timeDelta(getClosestPacificMidnight());
			return {
				success: false,
				reply: `No more YouTube searches available today! Reset happens at midnight Pacific Time, which is ${when}.`
			};
		}

		const index = context.params.index ?? 0;
		const { indexThreshold } = this.staticData;

		if (!sb.Utils.isValidInteger(index)) {
			return {
				success: false,
				reply: `Provided index must be a valid integer!`
			};
		}
		else if (index > indexThreshold) {
			return {
				success: false,
				reply: `Your index must be in the range <0, ${indexThreshold}>!`
			};
		}

		const tracks = await sb.Utils.searchYoutube(
			query,
			/** @type {string} */
			sb.Config.get("API_GOOGLE_YOUTUBE"),
			{
				maxResults: indexThreshold
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

		const data = await sb.Utils.modules.linkParser.fetchData(link);
		const published = new sb.Date(data.created).format("Y-m-d");
		const duration = sb.Utils.formatTime(data.duration, true);
		return {
			reply: sb.Utils.tag.trim `
				"${data.name}"
				by ${data.author},
				${sb.Utils.groupDigits(data.views)} views,
				published on ${published},
				duration: ${duration}
				${link}
			`
		};
	}),
	Dynamic_Description: null
};
