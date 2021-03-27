module.exports = {
	Name: "markov",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Creates a random sequence of words based on a Markov-chain module from Twitch chat.",
	Flags: ["non-nullable","pipe","use-params"],
	Params: [
		{ name: "stop", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 20,
		threshold: 500
	})),
	Code: (async function markov (context, input) {
		const { limit, threshold } = this.staticData;
		let wordCount = 10;
		let seed = null;

		if (input) {
			if (Number(input)) {
				const words = Number(input);

				if (!sb.Utils.isValidInteger(words, 1)) {
					return {
						success: false,
						reply: "Invalid number of words provided!"
					};
				}
				else if (input > limit) {
					return {
						success: false,
						reply: `Too many words! Current maximum: ${limit}`
					};
				}

				wordCount = words;
			}
			else {
				seed = input;
			}
		}

		const module = sb.ChatModule.get("async-markov-experiment");
		if (!module) {
			return {
				success: false,
				reply: "Markov-chain module is currently not available!"
			};
		}

		const { markov } = module.data;
		if (!markov || markov.size < threshold) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data avilable! (${markov?.size ?? 0}/${threshold} required)`
			};
		}

		if (typeof seed === "string" && !markov.has(seed)) {
			return {
				success: false,
				reply: "That word is not available as seed for random generation!"
			};
		}

		const string = markov.generateWords(wordCount, seed, {
			stop: Boolean(context.params.stop)
		});

		return {
			reply: string
		};

	}),
	Dynamic_Description: null
};