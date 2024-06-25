const { DEFAULT_REGION_KEY, getPlatform } = require("../../moba/league/utils.js");

module.exports = {
	name: "league-region",
	aliases: [],
	parameter: "arguments",
	description: "Lets you set a default region for the purposes of the $league command.",
	flags: {
		pipe: false
	},
	set: async (context, identifier) => {
		if (!identifier) {
			return {
				success: false,
				reply: "No region provided!"
			};
		}

		const isValid = getPlatform(identifier) !== null;
		if (!isValid) {
			return {
				success: false,
				reply: `Invalid region provided!`
			};
		}

		const existing = await context.user.getDataProperty(DEFAULT_REGION_KEY);
		await context.user.setDataProperty(DEFAULT_REGION_KEY, identifier);

		const string = (existing)
			? `changed your default $league region from ${existing} to ${identifier}`
			: `set your default $league region to ${identifier}`;

		return {
			reply: `Successfully ${string}.`
		};
	},
	unset: async (context) => {
		const existing = await context.user.getDataProperty(DEFAULT_REGION_KEY);
		if (!existing) {
			return {
				success: false,
				reply: `You don't have a default $league region set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty("defaultUserLanguage", null);
		return {
			reply: `Successfully unset your default $league region.`
		};
	}
};
