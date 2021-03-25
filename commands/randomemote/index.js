module.exports = {
	Name: "randomemote",
	Aliases: ["rem"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random emote from the scope of current channel. Configurable with parameters.",
	Flags: ["pipe","use-params"],
	Params: [
		{ name: "animated", type: "boolean" },
		{ name: "bttv", type: "boolean" },
		{ name: "ffz", type: "boolean" },
		{ name: "global", type: "boolean" },
		{ name: "sub", type: "boolean" },
		{ name: "twitch", type: "boolean" },
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 10
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

		const { animated, bttv, ffz, global: globalEmotes, sub, twitch } = context.params;
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
			if (globalEmotes === true && !i.global || globalEmotes === false && i.global) {
				return false;
			}
			if (sub === true && i.type !== "twitch-subscriber" || bttv === false && i.type === "twitch-subscriber") {
				return false;
			}
			if (twitch === true && i.type !== "twitch-global" || bttv === false && i.type === "twitch-global") {
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

		return {
			reply: [...Array(repeats)].map(() => sb.Utils.randArray(emotes).name).join(" ")
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
			"Posts any emote.",
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