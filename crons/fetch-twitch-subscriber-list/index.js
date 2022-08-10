module.exports = {
	Name: "fetch-twitch-subscriber-list",
	Expression: "0 0 * * * *",
	Description: "Fetches the current subscriber list, then saves it to sb.Cache",
	Defer: null,
	Type: "Bot",
	Code: (async function fetchTwitchSubscriberList () {
		const requiredConfigs = [
			"TWITCH_GQL_CLIENT_ID",
			"TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN",
			"ADMIN_USER_ID"
		];

		if (!requiredConfigs.every(config => sb.Config.has(config, true))) {
			return;
		}

		const response = await sb.Got("Helix", {
			url: "subscriptions",
			headers: {
				// client ID for @Supinic
				"Client-ID": sb.Config.get("TWITCH_CLIENT_ID"),
				// read subscriptions-only token for @Supinic
				Authorization: `Bearer ${sb.Config.get("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN")}`
			},
			searchParams: {
				broadcaster_id: sb.Config.get("ADMIN_USER_ID"),
				first: "100"
			}
		});

		if (response.statusCode !== 200) {
			console.warn("Could not fetch subscriber list", { response });
			return;
		}

		/** @type {SubscriberData[]} */
		const data = response.body.data;
		await sb.Cache.setByPrefix("twitch-subscriber-list-supinic", data, {
			expiry: 864e5 // 1 day
		});

		/**
		 * @typedef {Object} SubscriberData
		 * @property {string} broadcaster_id
		 * @property {string} broadcaster_login
		 * @property {string} broadcaster_name
		 * @property {string} gifter_id Empty string if not a gifted sub
		 * @property {string} gifter_login Empty string if not a gifted sub
		 * @property {string} gifter_name Empty string if not a gifted sub
		 * @property {boolean} is_gift
		 * @property {string} plan_name
		 * @property {string} tier
		 * @property {string} user_id
		 * @property {string} user_login
		 * @property {string} user_name
		 */
	})
};
