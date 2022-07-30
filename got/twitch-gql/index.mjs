export default {
	name: "TwitchGQL",
	optionsType: "function",
	options: (() => {
		const list = [
			"TWITCH_GQL_OAUTH",
			"TWITCH_GQL_CLIENT_ID",
			"TWITCH_GQL_CLIENT_VERSION",
			"TWITCH_GQL_DEVICE_ID"
		];

		if (list.some(i => !sb.Config.has(i, true))) {
			throw new Error("Twitch GQL sb.Got instance cannot initialize - missing configuration variable(s)");
		}

		return {
			method: "POST",
			url: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${sb.Config.get("TWITCH_GQL_OAUTH")}`,
				"Client-ID": sb.Config.get("TWITCH_GQL_CLIENT_ID"),
				"Client-Version": sb.Config.get("TWITCH_GQL_CLIENT_VERSION"),
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: "https://www.twitch.tv",
				"X-Device-ID": sb.Config.get("TWITCH_GQL_DEVICE_ID")
			}
		};
	}),
	parent: "Global",
	description: "Twitch GQL API"
};
