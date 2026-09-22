import { declare } from "../../classes/command.js";
import type AsyncMarkov from "async-markov";
import type { Channel } from "../../classes/channel.js";

const MODEL_SIZE_THRESHOLD = 25;
const WORD_AMOUNT = 25;

type ModuleRow = { channelId: Channel["ID"], name: Channel["Name"] };
const getMarkovData = (channel: Channel["ID"]) => (
	sb.ChatModule.getRuntimeData("async-markov-experiment", { scope: "channel", channel })
);

export default declare({
	Name: "markov",
	Aliases: null,
	Cooldown: 5000,
	Description: "Creates a random sequence of words based on a Markov-chain module from Twitch chat.",
	Flags: ["non-nullable", "pipe"],
	Params: [{ name: "channel", type: "string" }],
	Whitelist_Response: null,
	Code: function markov (context, input) {
		let runtime;
		if (context.params.channel) {
			const channelData = sb.Channel.get(context.params.channel);
			if (!channelData) {
				return {
					success: false,
					reply: "Invalid channel provided!"
				};
			}

			runtime = getMarkovData(channelData.ID);
		}
		else {
			if (context.channel) {
				runtime = getMarkovData(context.channel.ID);
			}

			runtime ??= getMarkovData(sb.Channel.getAsserted("forsen").ID);
		}

		if (!runtime) {
			return {
				success: false,
				reply: (context.params.channel)
					? "Your specific channel does not have a markov-chain module configured!"
					: "Could not load the markov-chain module for fallback channel!"
			};
		}

		const markov = (runtime.state as { markov: AsyncMarkov | null }).markov;
		if (!markov || markov.size < MODEL_SIZE_THRESHOLD) {
			return {
				success: false,
				reply: `Markov-chain module does not have enough data available! (${markov?.size ?? 0}/${MODEL_SIZE_THRESHOLD} required)`
			};
		}

		const string = markov.generateWords(WORD_AMOUNT, input);
		return {
			reply: `🔮 ${string}`
		};
	},
	Dynamic_Description: async function (prefix) {
		// @todo possibly implement a "get all channels/attachments for module name" method into sb.ChatModule
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
