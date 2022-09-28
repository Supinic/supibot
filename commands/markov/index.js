module.exports = {
	Name: "markov",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Creates a random sequence of words based on a Markov-chain module from Twitch chat.",
	Flags: ["non-nullable","pipe"],
	Params: [
		{ name: "debug", type: "string" },
		{ name: "dull", type: "boolean" },
		{ name: "channel", type: "string" },
		{ name: "exact", type: "boolean" },
		{ name: "stop", type: "boolean" },
		{ name: "words", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: (command => {
		command.data.updateCron = new sb.Cron({
			Name: "markov-word-list-updater",
			Description: "Regularly updates the available words in $markov.",
			Expression: "0 * * * * *",
			Code: (async function markovUpdater () {
				// early return - avoid errors during modules loading
				if (!sb.ChatModule || !sb.Channel) {
					return;
				}

				const module = sb.ChatModule.get("async-markov-experiment");
				if (!module || !module.data.markovs) {
					return;
				}

				const promises = [];
				for (const [channelID, markov] of module.data.markovs.entries()) {
					const words = markov.keys.sort();

					promises.push(sb.Cache.setByPrefix("markov-word-list", words, {
						keys: { channelID },
						expiry: 864e5
					}));
				}

				await Promise.all(promises);
			})
		});
		command.data.updateCron.start();

		const threshold = 100;
		return {
			limit: 20,
			threshold,
			destroy: (command) => {
				if (command.data.updateCron) {
					command.data.updateCron.destroy();
				}

				const module = sb.ChatModule.get("async-markov-experiment");
				const fs = require("fs").promises;

				for (const [channelID, markov] of module.data.markovs.entries()) {
					if (markov.size < threshold) {
						continue;
					}

					const fileName = `markov-dump-${new sb.Date().format("Y-m-d H:i")}-channel-${channelID}.json`;
					fs.writeFile(`/code/markovs/${fileName}`, JSON.stringify(markov));
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

		let targetChannel;
		if (context.params.channel) {
			targetChannel = sb.Channel.get(context.params.channel);
		}
		else if (context.channel && module.data.markovs?.has(context.channel.ID)) {
			targetChannel = context.channel;
		}
		else {
			targetChannel = sb.Channel.get("forsen"); // legacy fallback behaviour
		}

		if (!targetChannel) {
			return {
				success: false,
				reply: `No such channel exists!`
			};
		}

		const markov = module.data.markovs?.get(targetChannel.ID);
		if (!markov) {
			return {
				success: false,
				reply: "This channel does not have a markov-chain module configured!"
			};
		}

		if (context.params.debug) {
			const permissions = await context.getUserPermissions();
			if (!permissions.is("administrator")) {
				return {
					success: false,
					reply: `You don't have access to the debug commands!`
				};
			}

			const { debug } = context.params;
			const fs = require("fs").promises;
			const fileName = `markov-dump-${new sb.Date().format("Y-m-d")}-channel-${targetChannel.ID}.json`;
			if (debug === "save") {
				await fs.writeFile(`/code/markovs/${fileName}`, JSON.stringify(markov));
				return {
					reply: `Markov module data successfully saved to file.`
				};
			}
			else if (debug === "load") {
				const loadFileName = input ?? fileName;
				const data = await fs.readFile(`/code/markovs/${loadFileName}`);
				markov.reset();
				markov.load(data.toString());

				return {
					reply: `Markov module data successfully loaded from file.`
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

		if (markov.size < threshold) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data available! (${markov?.size ?? 0}/${threshold} required)`
			};
		}

		let wordCount = 15;
		if (context.params.words) {
			const { words } = context.params;
			if (!sb.Utils.isValidInteger(words, 1)) {
				return {
					success: false,
					reply: "Invalid number of words provided!"
				};
			}
			else if (words > limit) {
				return {
					success: false,
					reply: `Too many words! Current maximum: ${limit}`
				};
			}

			wordCount = words;
		}

		if (typeof input === "string" && !markov.has(input) && context.params.dull === true) {
			const exact = context.params.exact ?? false;
			if (exact) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						That exact word is not available as seed for random generation!
						Check the list here:
						https://supinic.com/data/other/markov/${targetChannel.ID}/words
					`
				};
			}

			// Try a case-insensitive search on the model's keys
			const keys = markov.keys;
			const lower = input.toLowerCase();
			for (let i = 0; i < keys.length; i++) {
				const word = keys[i];
				if (word.toLowerCase() === lower) {
					input = word;
					break;
				}
			}

			// Still not found despite case-insensitive search
			if (!markov.has(input)) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						That word is not available as seed for random generation!
						Check the list here:
						https://supinic.com/data/other/markov/${targetChannel.ID}/words
					`
				};
			}
		}

		const string = markov.generateWords(wordCount, input, {
			stop: Boolean(context.params.stop)
		});

		return {
			reply: `🔮 ${string}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const { threshold, limit } = this.staticData;
		const channels = await sb.Query.getRecordset(rs => rs
			.select("Channel.ID AS Channel_ID", "Name")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module = %s", "async-markov-experiment")
			.where("Channel.Platform = %n", 1)
			.join({
				toTable: "Channel",
				on: "Channel_Chat_Module.Channel = Channel.ID"
			})
		);

		const channelList = channels.map(i => (
			`<li><a href="//twitch.tv/${i.Name}">${i.Name}</a> -- <a href="/data/other/markov/${i.Channel_ID}/words">List of words</a>`
		)).join("");

		return [
			`Uses a <a href="//en.wikipedia.org/wiki/Markov_model">Markov model</a> to generate "real-looking" sentences based on Twitch chat.`,
			"Multiple channels can be supported, the command currently uses @Forsen's channel by default if no channel is provided.",
			`The model is not available until ${threshold} unique words have been added to it!`,
			"",

			`<code>${prefix}markov</code>`,
			"Generates 15 words, with the first one being chosen randomly.",
			"",

			`<code>${prefix}markov channel:(channel)</code>`,
			"Generates words in the specified channel's context.",
			`List of currently supported channels: <ul>${channelList}</ul>`,

			`<code>${prefix}markov dull:true (first word)</code>`,
			`Generates words, with your chosen word being the "seed", which is the first word in the sequence.`,
			"If your word isn't matched exactly, other, case-insensitive variants will be attempted.",
			"Like, if <code>4HEad</code> isn't in the word list, <code>4Head</code> will be used instead.",
			"If the parameter is not set to true, the generation will simply continue as if the word existed.",
			"",

			`<code>${prefix}markov exact:true</code>`,
			"If you want your seed word to be specific, use <code>exact:true</code> to force to use just that case-sensitive version.",
			"",

			`<code>${prefix}markov words:(number)</code>`,
			`Generates between 1-${limit} words, based on your choice.`,
			""
		];
	})
};
