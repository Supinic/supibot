module.exports = {
	/**
	 * @param {string} user
	 * @param options
	 */
	fetch: async (user, options = {}) => {
		const key = (options.seasonal)
			? `osrs-user-data-${user}`
			: `osrs-user-data-${user}-seasonal`;

		let data = (options.force)
			? null
			: await sb.Cache.getByPrefix(key);

		if (!data) {
			let response;
			if (!options.seasonal) {
				response = await sb.Got.get("Supinic")({
					url: `osrs/lookup/${user}`
				});
			}
			else {
				response = await sb.Got.get("Supinic")({
					url: `osrs/lookup/${user}`,
					searchParams: {
						seasonal: "1"
					}
				});
			}

			if (response.statusCode === 404 || !response.body.data) {
				return {
					success: false,
					reply: `No data found for player name "${user}"!`
				};
			}
			else if (response.statusCode === 502 || response.statusCode === 503) {
				const { message } = response.data.error;
				return {
					success: false,
					reply: `Could not reach the OSRS API: ${response.statusCode} ${message}`
				};
			}
			else if (!response.ok) {
				const { message } = response.data.error;
				return {
					success: false,
					reply: `Supinic OSRS API has failed: ${response.statusCode} ${message}`
				};
			}

			data = response.body.data;
			await sb.Cache.setByPrefix(key, data, {
				expiry: 600_000
			});
		}

		return data;
	},

	getIronman: (data, rude) => {
		let ironman = "user";
		if (data.ironman.deadHardcore) {
			ironman = (rude) ? "ex-hardcore ironman" : "ironman";
		}
		else if (data.ironman.regular) {
			ironman = "ironman";
		}
		else if (data.ironman.hardcore) {
			ironman = "hardcore ironman";
		}
		else if (data.ironman.ultimate) {
			ironman = "ultimate ironman";
		}

		if (ironman !== "user" && data.ironman.abandoned) {
			ironman = `de-ironed ${ironman}`;
		}

		return ironman;
	}
};
