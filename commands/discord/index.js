module.exports = {
	Name: "discord",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts the link to the current channel's Discord. Can be set up with the $set command.",
	Flags: ["external-input","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function discord (context) {
		if (context.privateMessage) {
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					No Discord server is available here, because you're whispering me instead of using the command in a channel.
					But hey, why not check out Supinic's Hackerman Club instead: https://discord.gg/RtYSuV9"
				`
			};
		}

		const discordDescription = await context.channel.getDataProperty("discord");
		return {
			reply: discordDescription ?? "This channel has no Discord description set up."
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Posts the link to the current channel's Discord description.",
		`Use the <a href="/bot/command/detail/set">${prefix}set discord</a> command to set up your custom description.`,
		"",

		`<code>${prefix}discord</code>`,
		"Posts the Discord description of the current channel, if set up."
	])
};
