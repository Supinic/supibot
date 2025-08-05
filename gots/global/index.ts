import { Agent } from "http2-wrapper";
import type { Http2Session } from "node:http2";
import { isGotRequestError, type GotInstanceDefinition } from "supi-core";

import config from "../../config.json" with { type: "json" };
const { defaultUserAgent } = config.modules.gots;

const agent = new Agent({
	maxEmptySessions: 100,
	maxCachedTlsSessions: 250
});
agent.on("session", (session: Http2Session) => {
	session.on("goaway", () => session.destroy());
});

export default {
	name: "Global",
	optionsType: "function",
	options: (() => ({
		responseType: "json",
		http2: true,
		agent: { http2: agent },
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
			afterResponse: [],
			beforeRedirect: [],
			beforeRetry: [],
			beforeRequest: [],
			init: [],
			beforeError: [
				async (err) => {
					if (!isGotRequestError(err)) {
						return err;
					}
					else if (err.code !== "ETIMEDOUT") {
						return err;
					}

					await sb.Logger.logError("Request", err, {
						origin: "External",
						context: {
							code: err.code,
							responseType: err.options.responseType,
							timeout: err.options.timeout,
							url: err.options.url?.toString() ?? null
						}
					});

					return err;
				}
			]
		}
	})),
	parent: null,
	description: "Global definition - template for all others"
} satisfies GotInstanceDefinition;
