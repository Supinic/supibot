import { TranslateSubcommands } from "./subcommands/index.js";
import { declare, type SubcommandDefinition } from "../../classes/command.js";
import type { User } from "../../classes/user.js";
import type { Channel } from "../../classes/channel.js";

let logTableExists: boolean | undefined;
export type TranslateSubcommandDefinition = SubcommandDefinition<typeof translateCommandDefinition>;

type LogTableRow = {
	User_Alias: User["ID"];
	Channel: Channel["ID"] | null;
	Engine: string;
	Excerpt: string;
	Input_Length: number;
	Output_Length: number | null;
	Success: boolean;
	Params: string | null;
};

export const translateCommandDefinition = declare({
	Name: "translate",
	Aliases: ["deepl"],
	Cooldown: 10000,
	Description: "Implicitly translates from auto-recognized language to English. Supports parameters 'from' and 'to'. Example: from:german to:french Guten Tag\"",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "confidence", type: "boolean" },
		{ name: "engine", type: "string" },
		{ name: "from", type: "string" },
		{ name: "formality", type: "string" },
		{ name: "to", type: "string" },
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	initialize: async () => {
		logTableExists = await core.Query.isTablePresent("data", "Translate_Log");
	},
	Code: (async function translate (context, ...args) {
		const query = args.join(" ");
		if (query.length === 0) {
			return {
				success: false,
				reply: "No text for translation provided!",
				cooldown: 2500
			};
		}

		let engine = "google";
		if (context.params.engine) {
			if (context.invocation === "deepl") {
				return {
					success: false,
					reply: "Don't get cheeky with me! (Can't use both the command alias and the engine parameter)"
				};
			}

			engine = context.params.engine;
		}
		else if (context.invocation === "deepl") {
			engine = "deepl";
		}

		const subcommand = TranslateSubcommands.get(engine);
		if (!subcommand) {
			return {
				success: false,
				reply: `Invalid translation engine provided! Use one of: ${TranslateSubcommands.names.join(", ")}`
			};
		}

		const result = await subcommand.execute.call(this, context, engine, query);
		if (logTableExists) {
			const row = await core.Query.getRow<LogTableRow>("data", "Translate_Log");
			row.setValues({
				User_Alias: context.user.ID,
				Channel: context.channel?.ID ?? null,
				Engine: engine,
				Excerpt: core.Utils.wrapString(query, 100),
				Input_Length: query.length,
				Output_Length: result.text?.length ?? null,
				Success: result.success,
				Params: (Object.keys(context.params).length !== 0) ? JSON.stringify(context.params) : null
			});

			await row.save({ skipLoad: true });
		}

		if (result.success === false) {
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
	Dynamic_Description: async (prefix) => {
		const subcommandDescriptions = await TranslateSubcommands.createDescription();
		return [
			"Translates provided text from one language into another provided language.",
			"Default languages are: from = auto-detected, to = English. This can be changed with the from and to parameters - see below.",
			"",

			`<code>${prefix}translate (text)</code>`,
			"Translates the text from auto-detected language to English.",
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
			"",

			`<code>${prefix}translate textOnly:true (text)</code>`,
			"Translates, and only outputs the result text without any surrounding command result text.",
			"",

			...subcommandDescriptions
		];
	}
});

export default translateCommandDefinition;
