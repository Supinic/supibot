export default {
	name: "linkify",
	aliases: [],
	description: "If the input is longer than the default (or provided) message length limit, posts a Hastebin instead. Otherwise, just re-posts the input again",
	examples: [
		["$abb linkify short text", "short text"],
		["$abb linkify some long text that will most likely never fit into a single message", "(hastebin link)"]
	],
	execute: async (context, ...args) => {
		const limit = context.params.limit ?? context.channel?.Message_Limit ?? context.platform.Message_Limit;
		if (!core.Utils.isValidInteger(limit, 0)) {
			return {
				success: false,
				reply: `Your provided limit must be a positive integer or exactly zero!`
			};
		}

		const query = args.join(" ");
		if (query.length <= limit) {
			return {
				success: true,
				hasExternalInput: true,
				reply: query
			};
		}

		const response = await core.Got.get("GenericAPI")({
			method: "POST",
			url: `https://haste.zneix.eu/documents`,
			throwHttpErrors: false,
			body: query
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Could not shorten your query!`
			};
		}

		return {
			reply: `https://haste.zneix.eu/raw/${response.body.key}`
		};
	}
};
