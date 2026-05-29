import * as z from "zod";
import type { GotInstanceDefinition } from "supi-core";

const oauthSchema = z.object({ access_token: z.string(), expires_in: z.int() });
const REDDIT_TOKEN_KEY = "reddit-token-cache-key";
const requiredKeys = [
	"API_REDDIT_USERNAME",
	"API_REDDIT_PASSWORD",
	"API_REDDIT_CLIENT_ID",
	"API_REDDIT_SECRET"
];

export default {
	name: "Reddit",
	optionsType: "function",
	options: (() => {
		const hasAllRequiredEnvs = requiredKeys.every(i => typeof process.env[i] === "string");
		if (!hasAllRequiredEnvs) {
			console.log(`Reddit Got instance will not use authorized requests - missing credentials. Check: ${requiredKeys.join(", ")}`);
			return {};
		}

		return {
			prefixUrl: "https://reddit.com/r/",
			throwHttpErrors: false,
			headers: {
				Cookie: "_options={%22pref_quarantine_optin%22:true,%22pref_gated_sr_optin%22:true};"
			},
			hooks: {
				afterResponse: [],
				beforeCache: [],
				beforeError: [],
				beforeRedirect: [],
				beforeRetry: [],
				init: [],
				beforeRequest: [
					async (options) => {
						let token = await core.Cache.getByPrefix(REDDIT_TOKEN_KEY) as string | null;
						if (!token) {
							const response = await core.Got.get("GenericAPI")({
								url: "https://www.reddit.com/api/v1/access_token",
								method: "POST",
								username: process.env.API_REDDIT_CLIENT_ID,
								password: process.env.API_REDDIT_SECRET,
								json: {
									grant_type: "password",
									username: process.env.API_REDDIT_USERNAME,
									password: process.env.API_REDDIT_PASSWORD
								}
							});

							if (!response.ok) {
								return; // can't do much here, just exit
							}

							const { access_token: accessToken, expires_in: expiry } = oauthSchema.parse(response.body);
							await core.Cache.setByPrefix(REDDIT_TOKEN_KEY, accessToken, { expiry });
							token = accessToken;
						}

						options.headers.authorization = `Bearer ${token}`;
					}
				]
			}
		};
	}),
	parent: "GenericAPI",
	description: "Reddit API"
} satisfies GotInstanceDefinition;
