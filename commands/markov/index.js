module.exports = {
	Name: "markov",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Creates a random sequence of words based on a Markov-chain module from Twitch chat.",
	Flags: ["non-nullable","pipe","use-params"],
	Params: [
		{ name: "stop", type: "boolean" },
		{ name: "debug", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		this.data.updateCron = new sb.Cron({
			Name: "markov-word-list-updater",
			Description: "Regularly updates the available words in $markov.",
			Expression: "0 * * * * *",
			Code: (async function markovUpdater () {
				const module = sb.ChatModule.get("async-markov-experiment");
				if (!module) {
					return;
				}

				const markov = module.data.markovs.get(sb.Channel.get("forsen"));
				if (!markov) {
					return;
				}

				const keys = markov.keys.sort();
				await sb.Cache.setByPrefix("markov-word-list", keys, {
					expiry: 864e5
				});
			})
		});
		this.data.updateCron.start();

		return {
			limit: 20,
			threshold: 250,
			destroy: (command) => {
				if (command.data.updateCron) {
					command.data.updateCron.destroy();
				}
			}
		};
	}),
	Code: (async function markov (context, input) {
		const { limit, threshold } = this.staticData;
		const module = sb.ChatModule.get("async-markov-experiment");
		if (!module) {
			return {
				success: false,
				reply: "Markov-chain module is not currently available!"
			};
		}

		const markov = module.data.markovs.get(sb.Channel.get("forsen"));
		if (!markov || markov.size < threshold) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data available! (${markov?.size ?? 0}/${threshold} required)`
			};
		}

		if (context.params.debug) {
			if (!await context.getUserPermissions("all", ["admin"])) {
				return {
					success: false,
					reply: `You don't have access to the debug commands!`
				};
			}

			const { debug } = context.params;
			if (debug === "save") {
				const fs = require("fs").promises;
				const name = `markov-dump-${new sb.Date().format("Y-m-d")}.json`;

				await fs.writeFile(`/code/markovs/${name}`, JSON.stringify(markov));
				return {
					reply: `Markov module data successfully saved to file.`
				};
			}
			else if (debug === "reset") {
				markov.reset();
				return {
					reply: `Markov module reset successfully.`
				};
			}
			else if (debug === "threshold") {
				const threshold = Number(input);
				if (!sb.Utils.isValidInteger(threshold)) {
					return {
						success: false,
						reply: `Dank number!`
					};
				}

				this.data.threshold = threshold;
			}
			else {
				return {
					success: false,
					reply: `Unknown debug command provided!`
				};
			}
		}

		let wordCount = 15;
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