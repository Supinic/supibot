module.exports = {
	Name: "randomemote",
	Aliases: ["rem"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random emote from the scope of current channel. Configurable with parameters.",
	Flags: ["pipe","use-params"],
	Params: [
		{ name: "7tv", type: "boolean" },
		{ name: "animated", type: "boolean" },
		{ name: "bttv", type: "boolean" },
		{ name: "ffz", type: "boolean" },
		{ name: "global", type: "boolean" },
		{ name: "repeat", type: "boolean" },
		{ name: "regex", type: "regex" },
		{ name: "sub", type: "boolean" },
		{ name: "twitch", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 200
	})),
	Code: (async function randomEmote (context, number = 1) {
		const repeats = Number(number);
		if (!sb.Utils.isValidInteger(repeats, 1) || repeats > this.staticData.limit) {
			return {
				success: false,
				reply: "Invalid or too high amount of emotes!"
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
			ffz,
			global: globalEmotes,
			sub,
			twitch
		} = context.params;

		emotes = emotes.filter(i => {
			if (animated === true && !i.animated || animated === false && i.animated) {
				return false;
			}
			if (bttv === true && i.type !== "bttv" || bttv === false && i.type === "bttv") {
				return false;
			}
			if (ffz === true && i.type !== "ffz" || ffz === false && i.type === "ffz") {
				return false;
			}
			if (sevenTv === true && i.type !== "7tv" || sevenTv === false && i.type === "7tv") {
				return false;
			}
			if (globalEmotes === true && !i.global || globalEmotes === false && i.global) {
				return false;
			}
			if (sub === true && i.type !== "twitch-subscriber" || sub === false && i.type === "twitch-subscriber") {
				return false;
			}
			if (twitch === true && i.type !== "twitch-global" || twitch === false && i.type === "twitch-global") {
				return false;
			}
			if (context.params.regex && !context.params.regex.test(i.name)) {
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

			const index = sb.Utils.random(0, emotes.length - 1);
			result.push(emotes[index].name);

			if (context.params.repeat === false) {
				emotes.splice(index, 1);
			}
		}

		const string = result.join(" ");
		const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;

		const [partition] = sb.Utils.partitionString(string, limit, 1);
		return {
			reply: partition
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { limit } = values.getStaticData();
		return [
			"Returns a random emote in the scope of the current channel.",
			"You can use parameters to force-include or exclude several of types of emotes.",
			`Maximum amount of words: ${limit}`,
			"",

			`<code>${prefix}rem</code>`,
			`<code>${prefix}randomemote</code>`,
			"Posts any single emote.",
			"",

			`<code>${prefix}rem (number)</code>`,
			`Posts any number of emotes, in the limit from 1 to ${limit}.`,
			"",

			`<code>${prefix}rem regex:(regular expression)</code>`,
			`<code>${prefix}rem regex:pepe</code>`,
			`<code>${prefix}rem regex:/^paja[HW]/</code>`,
			"Filters emotes by a provided regular expression. You can also just use plain text to filter as \"contains\".",
			"",

			`<code>${prefix}rem repeat:false</code>`,
			"If provided like this, then only unique emotes will be posted - no repeats.",
			"",

			`<code>${prefix}rem animated:true</code>`,
			`<code>${prefix}rem global:true</code>`,
			"Posts an emote, which must have the attribute specified",
			"E.g. <code>animated:true</code> will <u>only</u> post random animated emotes.",
			"These can be combined with types.",
			"",

			`<code>${prefix}rem animated:false</code>`,
			`<code>${prefix}rem global:false</code>`,
			"Posts an emote, which must <u>not</u> have the attribute specified",
			"E.g. <code>global:false</code> will random non-global emotes.",
			"",

			`<code>${prefix}rem bttv:true</code>`,
			`<code>${prefix}rem ffz:true</code>`,
			`<code>${prefix}rem sub:true</code>`,
			`<code>${prefix}rem twitch:true</code>`,
			"Posts an emote, which must be included in the set you specified.",
			"E.g. <code>bttv:true</code> will <u>only</u> post random BTTV emotes.",
			"Combining these will just result in zero emotes, as they don't share their types.",
			"",

			`<code>${prefix}rem animated:false</code>`,
			`<code>${prefix}rem bttv:false</code>`,
			`<code>${prefix}rem global:false</code>`,
			`<code>${prefix}rem ffz:false</code>`,
			`<code>${prefix}rem sub:false</code>`,
			`<code>${prefix}rem twitch:false</code>`,
			"Posts an emote, which must not be included in the set(s) you specified.",
			"E.g. <code>bttv:false</code> wil post random emotes that are <u>not</u> BTTV."
		];
	})
};
