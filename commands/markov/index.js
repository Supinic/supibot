const fs = require("node:fs").promises;
const { CronJob } = require("cron");

let config;
try {
	config = require("../../config.json");
}
catch {
	console.warn(`Custom config not found, $markov command will use base path "${__dirname}"`);
	config = { basePath: __dirname };
}

const BASE_PATH = config.basePath;
const MODEL_SIZE_THRESHOLD = 100;
const WORD_LIMIT = 20;
const DEFAULT_WORD_AMOUNT = 15;

const updateMarkovWordList = async () => {
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
};

export default {
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
	initialize: function () {
		const updateCronJob = new CronJob("0 * * * * *", () => updateMarkovWordList());

		updateCronJob.start();
		this.data.updateCronJob = updateCronJob;
	},
	destroy: function () {
		if (this.data.updateCronJob) {
			this.data.updateCronJob.stop();
		}

		const module = sb.ChatModule.get("async-markov-experiment");
		for (const [channelID, markov] of module.data.markovs.entries()) {
			if (markov.size < MODEL_SIZE_THRESHOLD) {
				continue;
			}

			const fileName = `markov-dump-${new sb.Date().format("Y-m-d H:i")}-channel-${channelID}.json`;
			fs.writeFile(`${BASE_PATH}/markovs/${fileName}`, JSON.stringify(markov));
		}
	},
	Code: async function markov (context, input) {
		const module = sb.ChatModule.get("async-markov-experiment");
		if (!module) {
			return {
				success: false,
				reply: "Markov-chain module is not currently available!"
			};
		}

		let targetChannel;
		if (context.params.channel) {
			/** @type {string} */
			const channelParameter = context.params.channel;
			const channelList = channelParameter
				.split(/\W/)
				.filter(Boolean)
				.map(i => sb.Channel.get(i))
				.filter(Boolean)
				.filter(i => module.data.markovs?.get(i.ID))
				.filter((i, ind, arr) => arr.indexOf(i) === ind);

			if (channelList.length === 0) {
				return {
					success: false,
					reply: `No valid channel(s) provided! You can only use those with Markov support enabled.`
				};
			}
			else if (channelList.length === 1) {
				targetChannel = sb.Channel.get(context.params.channel);
			}
			else {
				const results = [input].filter(Boolean);
				for (const channel of channelList) {
					const fakeContext = sb.Command.createFakeContext(this, {
						user: context.user,
						platform: context.platform,
						channel: context.channel,
						params: {
							channel: channel.Name,
							words: Math.floor(2 * WORD_LIMIT / channelList.length)
						}
					});

					const lastWord = results.at(-1);
					const commandResult = (lastWord)
						? await this.execute(fakeContext, lastWord)
						: await this.execute(fakeContext);

					if (commandResult.success === false) {
						return commandResult;
					}

					// Remove the last word, if available. Otherwise, the word will be duplicated across the commands'
					// results, since it is a "boundary" between the channels' markov chains.
					if (lastWord) {
						results.splice(-1, 1);
					}

					const string = commandResult.reply.replace("🔮", "").split(/\s+/);
					results.push(...string);
				}

				return {
					reply: `🔮 ${results.join(" ")}`
				};
			}
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
			if (debug === "reset") {
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

		if (markov.size < MODEL_SIZE_THRESHOLD) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data available! (${markov?.size ?? 0}/${MODEL_SIZE_THRESHOLD} required)`
			};
		}

		let wordCount = DEFAULT_WORD_AMOUNT;
		if (context.params.words) {
			const { words } = context.params;
			if (!sb.Utils.isValidInteger(words, 1)) {
				return {
					success: false,
					reply: "Invalid number of words provided!"
				};
			}
			else if (words > WORD_LIMIT) {
				return {
					success: false,
					reply: `Too many words! Current maximum: ${WORD_LIMIT}`
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
	},
	Dynamic_Description: async function (prefix) {
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
			"Various channels are supported, and the command currently uses @Forsen's channel by default if no channel is provided.",
			`The model is not available until ${MODEL_SIZE_THRESHOLD} unique words have been added to it!`,
			"",

			`<code>${prefix}markov</code>`,
			"Generates 15 words, with the first one being chosen randomly.",
			"",

			`<code>${prefix}markov channel:(channel)</code>`,
			"Generates words in the specified channel's context.",
			`List of currently supported channels: <ul>${channelList}</ul>`,
			"",

			`<code>${prefix}markov channel:(multiple channels)</code>`,
			`<code>${prefix}markov channel:supinic,forsen,pajlada</code>`,
			`<code>${prefix}markov channel:"forsen pajlada"</code>`,
			"Creates a chain of words from multiple channels, combining them together.",
			"",

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
			`Generates between 1-${WORD_LIMIT} words, based on your choice.`,
			""
		];
	}
};
