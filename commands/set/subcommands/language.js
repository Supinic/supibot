import LanguageCodes from "../../../utils/languages.js";

export default {
	name: "language",
	aliases: ["lang"],
	parameter: "arguments",
	description: "Lets you set your default translation language to be used in $translate.",
	flags: {
		pipe: false
	},
	set: async (context, ...args) => {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "No language provided!"
			};
		}

		const name = LanguageCodes.getName(query);
		if (!name) {
			return {
				success: false,
				reply: `Invalid or unsupported language name or code provided!`
			};
		}

		const code = LanguageCodes.getCode(name) ?? null;
		const existing = await context.user.getDataProperty("defaultUserLanguage");

		await context.user.setDataProperty("defaultUserLanguage", { code, name });

		const existingString = (existing)
			? `from ${existing.name ?? "(N/A)"} to`
			: "to";

		return {
			reply: `Successfully set your default $translate language ${existingString} ${name}.`
		};
	},
	unset: async (context) => {
		const existing = await context.user.getDataProperty("defaultUserLanguage");
		if (!existing) {
			return {
				success: false,
				reply: `You don't have a default $translate language set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty("defaultUserLanguage", null);
		return {
			reply: `Successfully unset your default $translate language.`
		};
	}
};
