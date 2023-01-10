module.exports = {
	/**
	 * @param {string} user
	 * @param options
	 */
	fetch: async (user, options = {}) => {
		let key;
		if (options.seasonal) {
			key = { user, seasonal: true };
		}
		else {
			key = { user };
		}

		let data = (options.force)
			? null
			: await sb.Cache.getByPrefix(key);

		if (!data) {
			let response;
			if (!options.seasonal) {
				response = await sb.Got("Supinic", {
					url: `osrs/lookup/${user}`
				});
			}
			else {
				response = await sb.Got("Supinic", {
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
