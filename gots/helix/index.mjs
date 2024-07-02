export const definition = {
	name: "Helix",
	optionsType: "function",
	options: (() => {
		if (!sb.Config.has("TWITCH_CLIENT_ID", true)) {
			throw new Error("Helix sb.Got instance cannot initialize - missing client-id");
		}
		else if (!sb.Config.has("TWITCH_OAUTH", true)) {
			throw new Error("Helix sb.Got instance cannot initialize - missing token");
		}

		return {
			prefixUrl: "https://api.twitch.tv/helix",
			headers: {
				"Client-ID": sb.Config.get("TWITCH_CLIENT_ID", true)
			},
			timeout: {
				request: 5000
			},
			retry: {
				limit: 3
			},
			hooks: {
				beforeRequest: [
					(options) => {
						const token = sb.Config.get("TWITCH_OAUTH", true);
						options.headers.authorization = `Bearer ${token}`;
					}
				]
			}
		};
	}),
	parent: "Global",
	description: "Twitch Helix API"
};
