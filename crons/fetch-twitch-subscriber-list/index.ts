import { SupiError } from "supi-core";
import type { CronDefinition } from "../index.js";
import { twitchIdentitySchema, twitchSubscriberSchema } from "../../utils/schemas.js";
import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };

const { TWITCH_ADMIN_SUBSCRIBER_LIST } = sharedKeys;

let tooManySubsWarningSent = false;
export default {
	name: "fetch-twitch-subscriber-list",
	expression: "0 0 0 * * *",
	description: "Fetches the current subscriber list, then saves it to core.Cache",
	code: (async function fetchTwitchSubscriberList () {
		if (!process.env.TWITCH_READ_SUBSCRIPTIONS_USER_ID) {
			throw new SupiError({
				message: "No Twitch user ID configured for Twitch subscriptions"
			});
		}

		const cacheRefreshToken = await core.Cache.getByPrefix("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN") as string | undefined;
		const envRefreshToken = process.env.TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN;
		if (!cacheRefreshToken && !envRefreshToken) {
			throw new SupiError({
				message: "No refresh token configured for Twitch subscriptions"
			});
		}

		const identityResponse = await core.Got.get("GenericAPI")({
			url: "https://id.twitch.tv/oauth2/token",
			method: "POST",
			searchParams: {
				grant_type: "refresh_token",
				refresh_token: cacheRefreshToken ?? envRefreshToken,
				client_id: process.env.TWITCH_CLIENT_ID,
				client_secret: process.env.TWITCH_CLIENT_SECRET
			}
		});

		const {
			access_token: accessToken,
			refresh_token: newRefreshToken
		} = twitchIdentitySchema.parse(identityResponse.body);

		await Promise.all([
			core.Cache.setByPrefix("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN", accessToken),
			core.Cache.setByPrefix("TWITCH_READ_SUBSCRIPTIONS_REFRESH_TOKEN", newRefreshToken)
		]);

		const subsResponse = await core.Got.get("GenericAPI")({
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

		const { data } = twitchSubscriberSchema.parse(subsResponse.body);
		if (data.length >= 100 && !tooManySubsWarningSent) {
			console.warn("Maximum subscribers reached for a single Helix call! Update this module to use pagination", { data });
			tooManySubsWarningSent = true;
		}

		await core.Cache.setByPrefix(TWITCH_ADMIN_SUBSCRIBER_LIST, data, {
			expiry: 864e5 // 1 day
		});
	})
} satisfies CronDefinition;
