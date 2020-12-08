module.exports = {
	Name: "youtubesearch",
	Aliases: ["ys"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Searches Youtube for video(s) with your query. Only a certain amount of uses are available daily.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: "Temporarily disabled",
	Static_Data: (() => ({
		maxUses: 50,
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
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No query provided!`,
				cooldown: 5000
			};
		}

		const { getClosestPacificMidnight, maxUses } = this.staticData;
		let remainingUsesToday = await this.getCacheData("remaining-uses");
		let cacheRecordExists = true;
		if (remainingUsesToday === null) {
			remainingUsesToday = maxUses;
			cacheRecordExists = false;
		}

		if (remainingUsesToday <= 0) {
			const when = sb.Utils.timeDelta(getClosestPacificMidnight());
			return {
				success: false,
				reply: `No more Youtube searches available today! Reset happens at midnight PT, which is ${when}.`
			};
		}

		const track = await sb.Utils.searchYoutube(
			query,
			sb.Config.get("API_GOOGLE_YOUTUBE"),
			{ single: true }
		);

		remainingUsesToday--;

		// @todo: Resolve a possible race-condition with multiple command invocations at the same time
		if (cacheRecordExists) {
			await this.setCacheData("remaining-uses", remainingUsesToday, {
				keepTTL: true
			});
		}
		else {
			await this.setCacheData("remaining-uses", remainingUsesToday, {
				expiresAt: getClosestPacificMidnight()
			});
		}
		
		if (!track) {
			return {
				success: false,
				reply: "No videos found for that query!",
				cooldown: {
					length: this.Cooldown,
					user: context.user.ID,
					channel: null,
					platform: null
				}
			};
		}
		else {
			return {
				reply: `https://youtu.be/${track.ID}`,
				cooldown: {
				length: this.Cooldown,
					user: context.user.ID,
					channel: null,
					platform: null
				}
			};
		}
	}),
	Dynamic_Description: null
};