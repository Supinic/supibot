export default {
	name: "Kraken",
	optionsType: "function",
	options: ((sb) => {
		if (!sb.Config.has("TWITCH_CLIENT_ID")) {
			throw new Error("Kraken sb.Got instance cannot initialize - missing client-id");
		}

		return {
			prefixUrl: "https://api.twitch.tv/kraken",
			headers: {
				Accept: "application/vnd.twitchtv.v5+json",
				"Client-ID": sb.Config.get("TWITCH_CLIENT_ID")
			}
		};
	}),
	parent: "Global",
	description: "Twitch Kraken API"
};
