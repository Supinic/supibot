let noConfigWarningSent = false;
let tooManySubsWarningSent = false;

export const definition = {
	name: "fetch-twitch-subscriber-list",
	expression: "0 0 * * * *",
	description: "Fetches the current subscriber list, then saves it to sb.Cache",
	code: (async function fetchTwitchSubscriberList () {
		const requiredConfigs = [
			"TWITCH_CLIENT_ID",
			"TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN",
			"TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN",
			"ADMIN_USER_ID"
		];

		const missingConfigs = requiredConfigs.filter(config => !sb.Config.has(config, true));
		if (missingConfigs.length !== 0) {
			if (!noConfigWarningSent) {
				console.warn("Cannot fetch subscribers, config(s) are missing", { missingConfigs })
				noConfigWarningSent = true;
			}

			return;
		}

		const identityResponse = await sb.Got("GenericAPI", {
			url: "https://id.twitch.tv/oauth2/token",
			method: "POST",
			searchParams: {
				grant_type: "refresh_token",
				refresh_token: sb.Config.get("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN"),
				client_id: sb.Config.get("TWITCH_CLIENT_ID"),
				client_secret: sb.Config.get("TWITCH_CLIENT_SECRET")
			}
		});

		const authToken = identityResponse.body.access_token;
		await Promise.all([
			sb.Config.set("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN", authToken),
			sb.Config.set("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN", identityResponse.body.refresh_token)
		]);

		const subsResponse = await sb.Got("Helix", {
			url: "subscriptions",
			headers: {
				"Client-ID": sb.Config.get("TWITCH_CLIENT_ID"),
				Authorization: `Bearer ${sb.Config.get("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN")}`
			},
			searchParams: {
				broadcaster_id: sb.Config.get("ADMIN_USER_ID"),
				first: "100"
			}
		});

		if (!subsResponse.ok) {
			console.warn("Could not fetch subscriber list", { subsResponse });
			return;
		}

		/** @type {SubscriberData[]} */
		const data = subsResponse.body.data;
		if (data.length >= 100 && !tooManySubsWarningSent) {
			console.warn("Maximum subscribers reached for a single Helix call! Update to use pagination", { data });
			tooManySubsWarningSent = true;
		}

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
