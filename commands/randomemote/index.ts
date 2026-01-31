import { randomInt } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";

const RESULT_CHARACTER_LIMIT = 50000; // @todo import from $pipe: // import { RESULT_CHARACTER_LIMIT } from "../pipe/index.js";
const MAXIMUM_EMOTE_LIMIT = 200;
const match = (flag: boolean | undefined, condition: boolean) => (flag === undefined || condition === flag);

export default declare({
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
	Code: (async function randomEmote (context, number = "1") {
		const repeats = Number(number);
		if (!core.Utils.isValidInteger(repeats, 1)) {
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

		const emotes = (context.channel)
			? await context.channel.fetchEmotes()
			: await context.platform.fetchGlobalEmotes();

		const {
			"7tv": sevenTv,
			animated,
			bttv,
			ffz,
			follower,
			global: globalEmotes,
			regex,
			sub,
			twitch,
			zeroWidth
		} = context.params;

		const filteredEmotes = emotes.filter(i => {
			const zw = ("zeroWidth" in i && match(zeroWidth, i.zeroWidth));
			return (
				match(animated, i.animated ?? false)
				&& match(globalEmotes, i.global)
				&& match(zeroWidth, zw)
				&& match(bttv, i.type === "bttv")
				&& match(ffz, i.type === "ffz")
				&& match(sevenTv, i.type === "7tv")
				&& match(sub, i.type === "twitch-subscriber")
				&& match(follower, i.type === "twitch-follower")
				&& match(twitch, i.type === "twitch-global")
				&& (!regex || regex.test(i.name))
			);
		});

		if (filteredEmotes.length === 0) {
			return {
				success: false,
				reply: "No emotes available for this combination of filters!"
			};
		}

		const result = [];
		for (let i = 0; i < repeats; i++) {
			if (filteredEmotes.length === 0) {
				break;
			}

			const index = randomInt(0, filteredEmotes.length - 1);
			result.push(filteredEmotes[index].name);

			if (context.params.repeat === false) {
				filteredEmotes.splice(index, 1);
			}
		}

		const string = result.join(" ");
		const messageLengthLimit = (context.append.pipe)
			? RESULT_CHARACTER_LIMIT // maximum character limit in a pipe command (resultCharacterLimit)
			: (context.channel?.Message_Limit ?? context.platform.Message_Limit);

		const [partition] = core.Utils.partitionString(string, messageLengthLimit, 1);
		return {
			success: true,
			reply: partition
		};
	}),
	Dynamic_Description: (prefix) => [
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
	]
});
