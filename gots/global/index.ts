import { Agent } from "http2-wrapper";
import type { Http2Session } from "node:http2";
import { type GotInstanceDefinition, isGotRequestError } from "supi-core";

import { getConfig } from "../../config.js";
import { logger } from "../../singletons/logger.js";
const { defaultUserAgent } = getConfig().modules.gots;

const agent = new Agent({
	timeout: 10_000,
	maxEmptySessions: 10,
	maxCachedTlsSessions: 100
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
			limit: 2,
			methods: ["GET", "PUT", "HEAD", "DELETE", "OPTIONS", "TRACE"],
			errorCodes: [
				"ETIMEDOUT",
				"ECONNRESET",
				"EADDRINUSE",
				"ECONNREFUSED",
				"EPIPE",
				"ENOTFOUND",
				"ENETUNREACH",
				"EAI_AGAIN",
				"ERR_GOT_REQUEST_ERROR"
			]
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
			beforeError: [
				async (err) => {
					if (!isGotRequestError(err)) {
						return err;
					}
					else if (!/HTTP\/2 stream has been early terminated/i.test(err.message)) {
						return err;
					}

					const { cause = null, code, options, timings } = err;
					const url = options.url?.toString() ?? null;
					await logger.logError("Request", err, {
						origin: "External",
						context: {
							url,
							method: options.method,
							code,
							cause: String(cause),
							responseType: options.responseType,
							timeout: options.timeout,
							http2: options.http2,
							retry: options.retry,
							timings,
							agentsStatus: {
								sessionCount: agent.sessionCount,
								emptySessionCount: agent.emptySessionCount,
								pendingSessionCount: agent.pendingSessionCount
							}
						}
					});

					agent.closeEmptySessions();

					return err;
				}
			]
		}
	})),
	parent: null,
	description: "Global definition - template for all others"
} satisfies GotInstanceDefinition;
