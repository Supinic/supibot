const { DEFAULT_USER_IDENTIFIER_KEY } = require("../../moba/league/utils.js");

module.exports = {
	name: "league-user",
	aliases: [],
	parameter: "arguments",
	description: "Lets you set a default user identifier for the purposes of the $league command.",
	flags: {
		pipe: false
	},
	set: async (context, ...args) => {
		const identifier = args.join(" ");
		if (!identifier) {
			return {
				success: false,
				reply: "No username provided!"
			};
		}

		const existing = await context.user.getDataProperty(DEFAULT_USER_IDENTIFIER_KEY);
		await context.user.setDataProperty(DEFAULT_USER_IDENTIFIER_KEY, identifier);

		const string = (existing)
			? `changed your default $league username from ${existing} to ${identifier}`
			: `set your default $league username to ${identifier}`;

		return {
			reply: `Successfully ${string}.`
		};
	},
	unset: async (context) => {
		const existing = await context.user.getDataProperty(DEFAULT_USER_IDENTIFIER_KEY);
		if (!existing) {
			return {
				success: false,
				reply: `You don't have a default $league username set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty(DEFAULT_USER_IDENTIFIER_KEY, null);
		return {
			reply: `Successfully unset your default $league username.`
		};
	}
};
