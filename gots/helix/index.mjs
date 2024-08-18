const { env } = globalThis.process;

export const definition = {
	name: "Helix",
	optionsType: "function",
	options: (() => {
		if (!env.TWITCH_CLIENT_ID) {
			throw new Error("Helix sb.Got instance cannot initialize - missing client-id");
		}

		return {
			prefixUrl: "https://api.twitch.tv/helix",
			headers: {
				"Client-ID": env.TWITCH_CLIENT_ID
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
						const token = await sb.Cache.getByPrefix("TWITCH_OAUTH");
						options.headers.authorization = `Bearer ${token}`;
					}
				]
			}
		};
	}),
	parent: "Global",
	description: "Twitch Helix API"
};
