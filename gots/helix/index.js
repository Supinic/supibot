export default {
	name: "Helix",
	optionsType: "function",
	options: (() => {
		if (!process.env.TWITCH_CLIENT_ID) {
			throw new Error("Helix core.Got instance cannot initialize - missing client-id");
		}

		return {
			prefixUrl: "https://api.twitch.tv/helix",
			headers: {
				"Client-ID": process.env.TWITCH_CLIENT_ID
			},
			timeout: {
				request: 5000
			},
			retry: {
				limit: 3
			},
			hooks: {
				beforeRequest: [
					async (options) => {
						const token = await core.Cache.getByPrefix("TWITCH_OAUTH");
						options.headers.authorization = `Bearer ${token}`;
					}
				]
			}
		};
	}),
	parent: "Global",
	description: "Twitch Helix API"
};
