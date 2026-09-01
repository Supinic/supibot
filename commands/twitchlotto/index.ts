import * as z from "zod";
import { prefix, randomInt } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";
import {
	createRecentUseCacheKey as getKey,
	formatScore
} from "./definitions.js";
import { probabilityShape } from "../../utils/schemas.js";

const detectionDefinitions = [
	{
		string: "Male Breast - Exposed",
		replacement: "male breast"
	},
	{
		string: "Male Genitalia - Exposed",
		replacement: "penis"
	},
	{
		string: "Male Genitalia - Covered",
		replacement: "covered penis"
	},
	{
		string: "Female Genitalia - Exposed",
		replacement: "vagina"
	},
	{
		string: "Female Genitalia - Covered",
		replacement: "covered vagina"
	},
	{
		string: "Female Breast - Exposed",
		replacement: "breast"
	},
	{
		string: "Female Breast - Covered",
		replacement: "covered breast"
	},
	{
		string: "Buttocks - Exposed",
		replacement: "ass"
	}
];

const dataSchema = z.object({
	detections: z.array(z.object({
		confidence: probabilityShape,
		name: z.string()
	}))
});

type TwitchLottoImage = {
	Link: string;
	Channel: string;
	Score: number | null;
	Available: boolean | null;
	Data: string | null;
	Adult_Flags: string[] | null;
};

const channels = new Set<string>();
const counts = new Map<string, number>();
let totalCount = 0;

export default declare({
	Name: "twitchlotto",
	Aliases: ["tl"],
	Cooldown: 10000,
	Description: "Fetches a random Imgur image from a Twitch channel (based off TwitchLotto).",
	Flags: ["mention"],
	Params: [],
	initialize: async () => {
		const channelNames = await core.Query.getRecordset<{ name: string, amount: number }[]>(rs => rs
			.select("LOWER(Name) AS name", "Amount AS amount")
			.from("data", "Twitch_Lotto_Channel")
			.flat("Name")
		);

		for (const { name, amount } of channelNames) {
			channels.add(name);
			counts.set(name, amount);
			totalCount += amount;
		}
	},
	Whitelist_Response: null,
	Code: (async function twitchLotto (context, channel, ...rest) {
		let offsetCount = totalCount;
		if (channel) {
			const channelName = channel.toLowerCase();
			if (!channels.has(channelName)) {
				if (rest.length > 0) {
					const { prefix } = sb.Command;
					return {
						success: false,
						reply: `This is the TwitchLotto command! You probably meant to use ${prefix}translate instead.`
					};
				}

				return {
					success: false,
					reply: `This channel is not currently supported! Check the list of supported channels here: ${this.getDetailURL()}`
				};
			}

			const potentialCount = counts.get(channelName);
			if (!potentialCount || potentialCount <= 0) {
				return {
					success: false,
					reply: `This channel does not have any pictures!`
				};
			}

			offsetCount = potentialCount;
		}

		let image: TwitchLottoImage;
		if (channel) {
			const roll = randomInt(1, offsetCount) - 1;
			image = await core.Query.getRecordset<TwitchLottoImage>(rs => rs
				.select("Link", "Channel", "Score", "Available", "Data", "Adult_Flags")
				.from("data", "Twitch_Lotto")
				.where("Channel = %s", channel)
				.offset(roll)
				.limit(1)
				.single()
			);
		}
		else {
			const roll = randomInt(1, offsetCount);
			const link = await core.Query.getRecordset<string>(rs => rs
				.select("Link")
				.from("data", "Twitch_Lotto")
				.orderBy("Link ASC")
				.limit(1)
				.offset(roll)
				.single()
				.flat("Link")
			);

			image = await core.Query.getRecordset<TwitchLottoImage>(rs => rs
				.select("Link", "Channel", "Score", "Available", "Data", "Adult_Flags")
				.from("data", "Twitch_Lotto")
				.where("Link = %s", link)
				.single()
			);
		}

		let appendix = "";
		if (image.Score === null) {
			appendix = `(no NSFW % score available, click at your own risk)`;
		}

		const detectionsStrings = [];
		if (image.Data) {
			const raw: unknown = JSON.parse(image.Data);
			const { detections } = dataSchema.parse(raw);

			for (const { replacement, string } of detectionDefinitions) {
				const elements = detections.filter(i => i.name === string);
				const strings = elements.map(i => `${replacement} (${Math.round(i.confidence * 100)}%)`);
				detectionsStrings.push(...strings);
			}
		}

		await core.Cache.setByPrefix(getKey(context), image.Link, {
			expiry: 600_000
		});

		let channelString = "";
		if (!channel) {
			const channels = await core.Query.getRecordset<string[]>(rs => rs
				.select("Channel")
				.from("data", "Twitch_Lotto")
				.where("Link = %s", image.Link)
				.flat("Channel")
			);

			channelString = `Posted in channel(s): ${channels.join(", ")}`;
		}

		const descriptionData = await core.Query.getRecordset<string | undefined>(rs => rs
			.select("Text")
			.from("data", "Twitch_Lotto_Description")
			.where("Link = %s", image.Link)
			.orderBy("Preferred DESC")
			.orderBy("Created ASC")
			.limit(1)
			.flat("Text")
			.single()
		);

		const descriptionString = (descriptionData) ? `Description: ${descriptionData}` : "";
		const flagsString = (image.Adult_Flags) ? `NSFW flags: ${image.Adult_Flags.join(", ")}` : "";
		const shouldRemoveEmbeds = (image.Score === null || image.Score > 0.66);

		return {
			removeEmbeds: (context.channel && !context.channel.NSFW && shouldRemoveEmbeds),
			reply: core.Utils.tag.trim `
				NSFW score: ${formatScore(image.Score)}
				Detections: ${detectionsStrings.length === 0 ? "N/A" : detectionsStrings.join(", ")}
				${flagsString}
				https://i.imgur.com/${image.Link}
				${channelString}
				${descriptionString}
				${appendix}
			`
		};
	}),
	Dynamic_Description: (prefix) => {
		const channelItems = [...channels].map(i => `<li>${i}</li>`).join(" ");
		return [
			`Rolls a random picture sourced from Twitch channels. The data is gathered from the <a href="//twitchlotto.com">Twitchlotto website</a>`,
			"You can specify a channel from the list below to get links only from there.",
			`You will get an approximation of "NSFW score" by an AI, so keep an eye out for that.`,
			"",

			`<code>${prefix}tl</code>`,
			`<code>${prefix}twitchlotto</code>`,
			"Fetches a random image from any channel - channels with more images have a bigger chance to be picked",
			"",

			`<code>${prefix}tl (channel)</code>`,
			"Fetches a random image from the specified channel. For list of channels, see below.",
			"",

			"Supported channels:",
			"<ul>",
			channelItems,
			"</ul>"
		];
	}
});
