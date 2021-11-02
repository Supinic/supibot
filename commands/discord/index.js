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
				reply: "There's no Discord in whispers..."
			};
		}

		return {
			reply: (context.channel.Data.discord) ?? "This channel has no Discord description set up."
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
