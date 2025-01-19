import { randomInt } from "../../utils/command-utils.js";
const MAXIMUM_EMOTE_LIMIT = 200;

export default {
	Name: "randomemote",
	Aliases: ["rem"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random emote from the scope of the current channel. Configurable with parameters.",
	Flags: ["pipe"],
	Params: [
		{ name: "7tv", type: "boolean" },
		{ name: "animated", type: "boolean" },
		{ name: "bttv", type: "boolean" },
		{ name: "channel", type: "string" },
		{ name: "ffz", type: "boolean" },
		{ name: "follower", type: "boolean" },
		{ name: "global", type: "boolean" },
		{ name: "repeat", type: "boolean" },
		{ name: "regex", type: "regex" },
		{ name: "sub", type: "boolean" },
		{ name: "twitch", type: "boolean" },
		{ name: "zeroWidth", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function randomEmote (context, number = 1) {
		const repeats = Number(number);

		if (!sb.Utils.isValidInteger(repeats, 1)) {
			return {
				success: false,
				reply: `You must provide a valid number of emotes to post! Use a number between 1 and ${MAXIMUM_EMOTE_LIMIT}.`
			};
		}
		else if (repeats > MAXIMUM_EMOTE_LIMIT) {
			return {
				success: false,
				reply: `The number you provided is too large! Use a number between 1 and ${MAXIMUM_EMOTE_LIMIT}.`
			};
		}

		let emotes;
		if (context.channel) {
			emotes = await context.channel.fetchEmotes();
		}
		else {
			emotes = await context.platform.fetchGlobalEmotes();
		}

		const {
			"7tv": sevenTv,
			animated,
			bttv,
			channel: channelString,
			ffz,
			follower,
			global: globalEmotes,
			sub,
			twitch,
			zeroWidth
		} = context.params;

		let channelPrefixRegex;
		if (channelString) {
			const prefixList = [];
			const channelList = channelString.split(/\W/);
			for (const channel of channelList) {
				let channelPrefix;
				const channelData = sb.Channel.get(channel, sb.Platform.get("twitch"));

				if (channelData) {
					channelPrefix = await channelData.getCacheData("emote-prefix");
				}

				if (!channelPrefix) {
					const response = await sb.Got.get("IVR")({
						url: "v2/twitch/user",
						searchParams: {
							login: channel
						}
					});

					if (response.statusCode !== 200 || response.body.length === 0) {
						return {
							success: false,
							reply: `Provided channel does not exist on Twitch!`
						};
					}

					const [channelInfo] = response.body;
					if (!channelInfo.emotePrefix) {
						return {
							success: false,
							reply: `Provided channel does not have a subscriber emote prefix!`
						};
					}

					channelPrefix = channelInfo.emotePrefix;
					if (channelData) {
						await channelData.setCacheData("emote-prefix", channelPrefix, { expiry: 30 * 864e5 }); // cache for 30 days
					}
				}

				prefixList.push(channelPrefix);
			}

			if (prefixList.length !== 0) {
				const string = prefixList.map(i => `${i}[A-Z0-9][A-Za-z0-9]*`).join("|");
				channelPrefixRegex = new RegExp(`^${string}$`);
			}
		}

		emotes = emotes.filter(i => {
			if ((animated === true && !i.animated) || (animated === false && i.animated)) {
				return false;
			}
			if ((zeroWidth === true && !i.zeroWidth) || (zeroWidth === false && i.zeroWidth)) {
				return false;
			}
			if ((bttv === true && i.type !== "bttv") || (bttv === false && i.type === "bttv")) {
				return false;
			}
			if ((ffz === true && i.type !== "ffz") || (ffz === false && i.type === "ffz")) {
				return false;
			}
			if ((sevenTv === true && i.type !== "7tv") || (sevenTv === false && i.type === "7tv")) {
				return false;
			}
			if ((globalEmotes === true && !i.global) || (globalEmotes === false && i.global)) {
				return false;
			}
			if ((sub === true && i.type !== "twitch-subscriber") || (sub === false && i.type === "twitch-subscriber")) {
				return false;
			}
			if ((follower === true && i.type !== "twitch-follower") || (follower === false && i.type === "twitch-follower")) {
				return false;
			}
			if ((twitch === true && i.type !== "twitch-global") || (twitch === false && i.type === "twitch-global")) {
				return false;
			}
			if (context.params.regex && !context.params.regex.test(i.name)) {
				return false;
			}
			if (channelPrefixRegex && (!channelPrefixRegex.test(i.name) || i.type !== "twitch-subscriber")) {
				return false;
			}

			return true;
		});

		if (emotes.length === 0) {
			return {
				success: false,
				reply: "No emotes available for this combination of filters!"
			};
		}

		const result = [];
		for (let i = 0; i < repeats; i++) {
			if (emotes.length === 0) {
				break;
			}

			const index = randomInt(0, emotes.length - 1);
			result.push(emotes[index].name);

			if (context.params.repeat === false) {
				emotes.splice(index, 1);
			}
		}

		const string = result.join(" ");
		const messageLengthLimit = (context.append.pipe)
			? 50_000 // maximum character limit in a pipe command (resultCharacterLimit)
			: (context.channel?.Message_Limit ?? context.platform.Message_Limit);

		const [partition] = sb.Utils.partitionString(string, messageLengthLimit, 1);
		return {
			reply: partition
		};
	}),
	Dynamic_Description: (async function (prefix) {
		return [
			"Returns a random emote in the scope of the current channel.",
			"You can use parameters to force-include or exclude several of types of emotes.",
			`Maximum amount of emotes: ${MAXIMUM_EMOTE_LIMIT}`,
			"",

			`<code>${prefix}rem</code>`,
			`<code>${prefix}randomemote</code>`,
			"Posts any single emote.",
			"",

			`<code>${prefix}rem (number)</code>`,
			`Posts any number of emotes, in the limit from 1 to ${MAXIMUM_EMOTE_LIMIT}.`,
			"",

			`<code>${prefix}rem regex:(regular expression)</code>`,
			`<code>${prefix}rem regex:pepe</code>`,
			`<code>${prefix}rem regex:/^paja[HW]/</code>`,
			"Filters emotes by a provided regular expression. You can also just use plain text to filter as \"contains\".",
			"",

			`<code>${prefix}rem repeat:false</code>`,
			"If provided like this, then only unique emotes will be posted - no repeats.",
			"",

			`<code>${prefix}rem channel:(single channel or channel list)</code>`,
			`<code>${prefix}rem channel:supinic</code>`,
			`<code>${prefix}rem channel:supinic,pajlada,zneix</code>`,
			`<code>${prefix}rem channel:"supinic pajlada forsen"</code>`,
			"For a provided Twitch channel, this will attempt to use only its subscriber emotes that Supibot has available",
			"",

			`<code>${prefix}rem animated:true</code>`,
			`<code>${prefix}rem global:true</code>`,
			`<code>${prefix}rem zeroWidth:true</code>`,
			"Posts an emote, which must have the attribute specified",
			"E.g. <code>animated:true</code> will <u>only</u> post random animated emotes.",
			"These can be combined with types.",
			"",

			`<code>${prefix}rem animated:false</code>`,
			`<code>${prefix}rem global:false</code>`,
			`<code>${prefix}rem zeroWidth:false</code>`,
			"Posts an emote, which must <u>not</u> have the attribute specified",
			"E.g. <code>global:false</code> will random non-global emotes.",
			"",

			`<code>${prefix}rem 7tv:true</code>`,
			`<code>${prefix}rem bttv:true</code>`,
			`<code>${prefix}rem ffz:true</code>`,
			`<code>${prefix}rem sub:true</code>`,
			`<code>${prefix}rem follower:true</code>`,
			`<code>${prefix}rem twitch:true</code>`,
			"Posts an emote, which must be included in the set you specified.",
			"E.g. <code>bttv:true</code> will <u>only</u> post random BTTV emotes.",
			"Combining these will just result in zero emotes, as they don't share their types.",
			"Note: <code>twitch</code> applies to twitch global emotes only; <code>sub</code> applies to twitch subscribes emotes only.",
			"",

			`<code>${prefix}rem 7tv:false</code>`,
			`<code>${prefix}rem animated:false</code>`,
			`<code>${prefix}rem bttv:false</code>`,
			`<code>${prefix}rem global:false</code>`,
			`<code>${prefix}rem ffz:false</code>`,
			`<code>${prefix}rem sub:false</code>`,
			`<code>${prefix}rem follower:false</code>`,
			`<code>${prefix}rem twitch:false</code>`,
			"Posts an emote, which must not be included in the set(s) you specified.",
			"E.g. <code>bttv:false</code> wil post random emotes that are <u>not</u> BTTV.",
			"Note: <code>twitch</code> applies to twitch global emotes only; <code>sub</code> applies to twitch subscribes emotes only."
		];
	})
};
