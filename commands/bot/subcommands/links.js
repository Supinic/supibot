module.exports = {
	name: "links",
	aliases: ["enable-links", "disable-links"],
	description: [
		`<code>$bot enable-links</code>`,
		`<code>$bot disable-links</code>`,
		`<code>$bot enable-links channel:(channel)</code>`,
		`<code>$bot disable-links channel:(channel)</code>`,
		"Disables or enables automatic replacement of all links in a channel.",
		`If enabled, all links will be replaced by "[LINK]" or a similar placeholder.`,
	],
	execute: async (context, options = {}) => {
		const { subcommand, channelData } = options;
		if (subcommand === "links") {
			return {
				success: false,
				reply: `Use "$bot enable-links" or "$bot disable-links" instead!`
			};
		}
		
		/** @type {"enable"|"disable"} */
		const action = subcommand.replace("-links", "");
		const current = channelData.Links_Allowed;
		
		if ((current && action === "enable") || (!current && action === "disable")) {
			return {
				success: false,
				reply: `Links are already ${action}d in channel "${channelData.Name}"!`
			};
		}

		await channelData.saveProperty("Links_Allowed", !current);

		return {
			reply: `Links are now ${action}d in channel "${channelData.Name}".`
		};
	}
};
