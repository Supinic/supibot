import { SupiError } from "supi-core";
import type AsyncMarkov from "async-markov";
import { declare } from "../../classes/command.js";
import type { Channel } from "../../classes/channel.js";

const MODEL_SIZE_THRESHOLD = 25;
const WORD_AMOUNT = 25;

type ModuleRow = { channelId: Channel["ID"], name: Channel["Name"] };
const getMarkovData = () => {
	const module = sb.ChatModule.get("async-markov-experiment");
	if (!module) {
		throw new SupiError({
			message: "Assert error: Markov module is not available"
		});
	}

	const { data } = module;
	if (!("markovs" in data)) {
		throw new SupiError({
			message: "Assert error: Markov module has no specific data available"
		});
	}

	return {
		// @todo use proper typing for markov's chat module when available
		markovs: data.markovs as Map<Channel["ID"], AsyncMarkov>
	};
};

export default declare({
	Name: "markov",
	Aliases: null,
	Cooldown: 5000,
	Description: "Creates a random sequence of words based on a Markov-chain module from Twitch chat.",
	Flags: ["non-nullable", "pipe"],
	Params: [{ name: "channel", type: "string" }],
	Whitelist_Response: null,
	Code: function markov (context, input) {
		let markov;
		const { markovs } = getMarkovData();
		if (context.params.channel) {
			const channelData = sb.Channel.get(context.params.channel);
			if (!channelData) {
				return {
					success: false,
					reply: "Invalid channel provided!"
				};
			}

			markov = markovs.get(channelData.ID);
		}
		else {
			if (context.channel) {
				markov = markovs.get(context.channel.ID);
			}

			markov ??= markovs.get(sb.Channel.getAsserted("forsen").ID);
		}

		if (!markov) {
			return {
				success: false,
				reply: (context.params.channel)
					? "Your specific channel does not have a markov-chain module configured!"
					: "Could not load the markov-chain module for fallback channel!"
			};
		}
		else if (markov.size < MODEL_SIZE_THRESHOLD) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data available! (${markov.size}/${MODEL_SIZE_THRESHOLD} required)`
			};
		}

		const string = markov.generateWords(WORD_AMOUNT, input);
		return {
			reply: `🔮 ${string}`
		};
	},
	Dynamic_Description: async function (prefix) {
		const channels = await core.Query.getRecordset<ModuleRow[]>(rs => rs
			.select("Channel.ID AS channelId", "Channel.Name as name")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module = %s", "async-markov-experiment")
			.where("Channel.Platform = %n", 1)
			.where("Channel.Mode <> %s", "Inactive")
			.join({
				toTable: "Channel",
				on: "Channel_Chat_Module.Channel = Channel.ID"
			})
		);

		const channelList = channels.map(i => (
			`<li><a href="//twitch.tv/${i.name}">${i.name}</a>`
		)).join("");

		return [
			`Uses a <a href="//en.wikipedia.org/wiki/Markov_model">Markov model</a> to generate "real-looking" sentences based on Twitch chat.`,
			"Only the below listed channel are supported.",
			"",

			`<code>${prefix}markov</code>`,
			"Generates random words.",
			"Uses the current channel's markov-chain module, if it is configured.",
			"If not, defaults to the module running in @Forsen's channel.",
			"",

			`<code>${prefix}markov channel:(channel)</code>`,
			"Generates words in the specified channel's context.",
			"",

			`List of currently supported channels: <ul>${channelList}</ul>`
		];
	}
});
