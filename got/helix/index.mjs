export default {
	name: "Helix",
	optionsType: "function",
	options: (() => {
		if (!sb.Config.has("TWITCH_CLIENT_ID")) {
			throw new Error("Helix sb.Got instance cannot initialize - missing client-id");
		}

		const token = sb.Config.get("TWITCH_OAUTH", false);
		if (!token) {
			throw new Error("Helix sb.Got instance cannot initialize - missing token");
		}

		return {
			prefixUrl: "https://api.twitch.tv/helix",
			headers: {
				"Client-ID": sb.Config.get("TWITCH_CLIENT_ID"),
				Authorization: `Bearer ${token.replace("oauth:", "")}`
			}
		};
	}),
	parent: "Global",
	description: "Twitch Helix API"
};
