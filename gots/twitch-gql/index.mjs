export const definition = {
	name: "TwitchGQL",
	optionsType: "function",
	options: (() => {
		if (!process.env.TWITCH_GQL_OAUTH) {
			throw new Error("Missing GQL Oauth env value");
		}
		if (!process.env.TWITCH_GQL_CLIENT_ID) {
			throw new Error("Missing GQL Client-ID env value");
		}

		const headers = {
			Accept: "*/*",
			"Accept-Language": "en-US",
			Authorization: `OAuth ${process.env.TWITCH_GQL_OAUTH}`,
			"Client-ID": `OAuth ${process.env.TWITCH_GQL_CLIENT_ID}`,
			"Content-Type": "text/plain;charset=UTF-8",
			Referer: "https://www.twitch.tv"
		};

		if (process.env.TWITCH_GQL_CLIENT_VERSION) {
			headers["Client-Version"] = process.env.TWITCH_GQL_CLIENT_VERSION;
		}
		if (process.env.TWITCH_GQL_DEVICE_ID) {
			headers["X-Device-ID"] = process.env.TWITCH_GQL_DEVICE_ID;
		}

		return {
			method: "POST",
			prefixUrl: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers
		};
	}),
	parent: "Global",
	description: "Twitch GQL API"
};
