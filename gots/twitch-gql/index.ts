import type { GotRegistryInstanceDefinition } from "supi-core";

export default {
	name: "TwitchGQL",
	options: (() => {
		const {
			TWITCH_GQL_OAUTH: oauth,
			TWITCH_GQL_CLIENT_ID: clientId,
			TWITCH_GQL_CLIENT_VERSION: version,
			TWITCH_GQL_DEVICE_ID: deviceId
		} = process.env;

		if (!oauth || !clientId || !version || !deviceId) {
			throw new Error("Twitch GQL core.Got instance cannot initialize - missing configuration variable(s)");
		}

		return {
			method: "POST",
			prefixUrl: "https://gql.twitch.tv",
			allowAbsoluteUrls: false,
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${oauth}`,
				"Client-ID": clientId,
				"Client-Version": version,
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: "https://www.twitch.tv",
				"X-Device-ID": deviceId
			}
		};
	}),
	parent: "Global"
} satisfies GotRegistryInstanceDefinition;
