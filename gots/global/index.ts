import { Agent } from "http2-wrapper";
import type { Http2Session } from "node:http2";
import type { GotInstanceDefinition } from "supi-core";

import { getConfig } from "../../config.js";
const { defaultUserAgent } = getConfig().modules.gots;

const agent = new Agent({
	timeout: 15_000,
	maxEmptySessions: 25,
	maxCachedTlsSessions: 250
});

agent.on("session", (session: Http2Session) => {
	session.once("goaway", () => {
		session.close();
		setTimeout(() => {
			if (!session.destroyed && !session.closed) {
				session.destroy();
			}
		}, 30_000).unref();
	});
});

export default {
	name: "Global",
	optionsType: "function",
	options: (() => ({
		responseType: "json",
		http2: true,
		agent: { http2: agent },
		retry: {
			limit: 2
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
			beforeCache: [],
			beforeRetry: [],
			beforeRequest: [],
			init: [],
			beforeError: []
		}
	})),
	parent: null,
	description: "Global definition - template for all others"
} satisfies GotInstanceDefinition;
