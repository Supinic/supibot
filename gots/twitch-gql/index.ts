const list = [
	"TWITCH_GQL_OAUTH",
	"TWITCH_GQL_CLIENT_ID",
	"TWITCH_GQL_CLIENT_VERSION",
	"TWITCH_GQL_DEVICE_ID"
];

export default {
	name: "TwitchGQL",
	optionsType: "function",
	options: (() => {
		if (list.some(key => !process.env[key])) {
			throw new Error("Twitch GQL sb.Got instance cannot initialize - missing configuration variable(s)");
		}

		return {
			method: "POST",
			prefixUrl: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${process.env.TWITCH_GQL_OAUTH}`,
				"Client-ID": process.env.TWITCH_GQL_CLIENT_ID,
				"Client-Version": process.env.TWITCH_GQL_CLIENT_VERSION,
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: "https://www.twitch.tv",
				"X-Device-ID": process.env.TWITCH_GQL_DEVICE_ID
			}
		};
	}),
	parent: "Global",
	description: "Twitch GQL API"
};
