import type { GotInstanceDefinition } from "supi-core";
export default {
	name: "Reddit",
	optionsType: "function",
	options: (() => {
		const options: Record<string, unknown> = {
			prefixUrl: "https://reddit.com/r/",
			throwHttpErrors: false,
			headers: {
				Cookie: "_options={%22pref_quarantine_optin%22:true,%22pref_gated_sr_optin%22:true};"
			}
		};

		if (process.env.API_REDDIT_USERNAME && process.env.API_REDDIT_SECRET) {
			options.username = process.env.API_REDDIT_USERNAME;
			options.password = process.env.API_REDDIT_SECRET;
		}
		else {
			console.log("Reddit Got instance will not use authorized requests - no credentials found");
		}

		return options;
	}),
	parent: "GenericAPI",
	description: "Reddit API"
} satisfies GotInstanceDefinition;
