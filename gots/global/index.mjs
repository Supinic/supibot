import config from "../../config.json" with { type: "json" };
const { defaultUserAgent } = config.modules.gots;

export const definition = {
	name: "Global",
	optionsType: "function",
	options: (() => ({
		responseType: "json",
		http2: true,
		retry: {
			limit: 0
		},
		timeout: {
			request: 30000
		},
		mutableDefaults: true,
		throwHttpErrors: false,
		headers: {
			"User-Agent": defaultUserAgent
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
