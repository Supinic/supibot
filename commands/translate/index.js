module.exports = {
	Name: "translate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Implicitly translates from auto-recognized language to English. Supports parameters 'from' and 'to'. Example: from:german to:french Guten Tag\",",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "confidence", type: "boolean" },
		{ name: "engine", type: "string" },
		{ name: "from", type: "string" },
		{ name: "to", type: "string" },
		{ name: "textOnly", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		engines: ["deepl", "google"]
	})),
	Code: (async function translate (context, ...args) {
		const query = args.join(" ");
		if (query.length === 0) {
			return {
				success: false,
				reply: "No text for translation provided!",
				cooldown: 2500
			};
		}

		const { engines } = this.staticData;
		const engine = context.params.engine ?? "google";
		if (!engines.includes(engine)) {
			return {
				success: false,
				reply: `Invalid translation engine provided! Use one of: ${engines.join(", ")}`
			};
		}

		const { execute } = require(`./${engine}.js`);
		const result = await execute(context, query);
		if (!result.success) {
			return result;
		}
		else if (context.params.textOnly && result.text) {
			return {
				reply: result.text
			};
		}
		else {
			return {
				reply: result.reply
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Translates provided text from one language into another provided language.",
		"Default languages are: from = auto-detected, to = English. This can be changed with the from and to parameters - see below.",
		"",

		`<code>${prefix}translate (text)</code>`,
		"Translates the text from auto-detected language to English, e.g.:",
		`<code>${prefix}translate FeelsDankMan</code> => Luxembourgish (53%) -> English: FeelsDankMan`,
		"",

		`<code>${prefix}translate engine:(translation engine)</code>`,
		"Allows you to choose a translation engine. Keep in mind they both support different parameters and languages!",
		"Supported: <code>google</code> and <code>deepl</code>",
		"",

		`<code>${prefix}translate textOnly:true (text)</code>`,
		"Translates the text, and only outputs the result text, without the direction and confidence %, e.g.:",
		`<code>${prefix}translate textOnly:true FeelsDankMan</code> => FeelsDankMan`,
		"",

		`<code>${prefix}translate confidence:false (text)</code>`,
		"<b>Only works for the Google translation engine!</b>",
		"Translates the text, and outputs the result text with direction, but without the confidence %, e.g.:",
		`<code>${prefix}translate confidence:false FeelsDankMan</code> => Luxembourgish -> English: FeelsDankMan`,
		"",

		`<code>${prefix}translate from:fr (text)</code>`,
		`<code>${prefix}translate from:french (text)</code>`,
		`<code>${prefix}translate from:French (text)</code>`,
		"Translates the text from a provided language (French here, can use a language code or name) to English.",
		"The language auto-detection usually works fine. However, if you run into issues or if the text is too short, you can force the source langauge.",
		"",

		`<code>${prefix}translate to:de (text)</code>`,
		`<code>${prefix}translate to:german (text)</code>`,
		`<code>${prefix}translate to:German (text)</code>`,
		"Translates the text from a auto-detected language to a provided language (German here).",
		"",

		`<code>${prefix}translate to:italian from:swahili (text)</code>`,
		"Both parameters can be combined together for maximum accuracy.",
		"",

		`<code>${prefix}translate to:random (text)</code>`,
		"Translates provided text to a randomly picked, supported language.",
		""
	])
};
