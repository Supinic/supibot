import { Error as SupiError } from "supi-core";
import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { sb } from "../../@types/globals.js";

const { TWITCH_ADMIN_SUBSCRIBER_LIST } = sharedKeys;

let tooManySubsWarningSent = false;

type SubscriberData = {
	broadcaster_id: string,
	broadcaster_login: string,
	broadcaster_name: string,
	gifter_id: string, // Empty string if not a gifted sub
	gifter_login: string, // Empty string if not a gifted sub
	gifter_name: string,  // Empty string if not a gifted sub
	is_gift: boolean,
	plan_name: string,
	tier: string,
	user_id: string,
	user_login: string,
	user_name: string,
};

export const definition = {
	name: "fetch-twitch-subscriber-list",
	expression: "0 0 0 * * *",
	description: "Fetches the current subscriber list, then saves it to sb.Cache",
	code: (async function fetchTwitchSubscriberList () {
		if (!process.env.TWITCH_READ_SUBSCRIPTIONS_USER_ID) {
			throw new SupiError({
				message: "No Twitch user ID configured for Twitch subscriptions"
			});
		}

		const cacheRefreshToken = await sb.Cache.getByPrefix("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN")
		const envRefreshToken = process.env.TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN;
		if (!cacheRefreshToken && !envRefreshToken) {
			throw new SupiError({
				message: "No refresh token configured for Twitch subscriptions"
			});
		}

		const identityResponse = await sb.Got("GenericAPI", {
			url: "https://id.twitch.tv/oauth2/token",
			method: "POST",
			searchParams: {
				grant_type: "refresh_token",
				refresh_token: cacheRefreshToken ?? envRefreshToken,
				client_id: process.env.TWITCH_CLIENT_ID,
				client_secret: process.env.TWITCH_CLIENT_SECRET
			}
		});

		const accessToken = identityResponse.body.access_token;
		const newRefreshToken = identityResponse.body.refresh_token;
		await Promise.all([
			sb.Cache.setByPrefix("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN", accessToken),
			sb.Cache.setByPrefix("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN", newRefreshToken)
		]);

		const subsResponse = await sb.Got("GenericAPI", {
			url: "https://api.twitch.tv/helix/subscriptions",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				"Client-ID": process.env.TWITCH_CLIENT_ID,
				Authorization: `Bearer ${accessToken}`
			},
			searchParams: {
				broadcaster_id: process.env.TWITCH_READ_SUBSCRIPTIONS_USER_ID,
				first: "100"
			}
		});

		if (!subsResponse.ok) {
			console.warn("Could not fetch subscriber list", { subsResponse });
			return;
		}

		const data: SubscriberData[] = subsResponse.body.data;
		if (data.length >= 100 && !tooManySubsWarningSent) {
			console.warn("Maximum subscribers reached for a single Helix call! Update this module to use pagination", { data });
			tooManySubsWarningSent = true;
		}

		await sb.Cache.setByPrefix(TWITCH_ADMIN_SUBSCRIBER_LIST, data, {
			expiry: 864e5 // 1 day
		});

	})
};
