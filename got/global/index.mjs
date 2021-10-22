export default {
	name: "Global",
	optionsType: "function",
	options: (() => ({
		responseType: "json",
		retry: 0,
		timeout: 30000,
		mutableDefaults: true,
		throwHttpErrors: false,
		headers: {
			"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
		},
		hooks: {
			beforeError: [
				async (err) => {
					if (!err || err.code !== "ETIMEDOUT" || typeof globalThis?.sb?.Logger?.logError !== "function") {
						return err;
					}

					await sb.Logger.logError("Request", err, {
						origin: "External",
						context: {
							code: err.code,
							responseType: err.options?.responseType ?? null,
							timeout: err.options?.timeout ?? null,
							url: err.options?.url?.toString?.() ?? null
						},
						arguments: null
					});

					return err;
				}
			]
		}
	})),
	parent: null,
	description: "Global definition - template for all others"
};
