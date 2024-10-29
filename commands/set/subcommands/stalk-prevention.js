module.exports = {
	name: "stalk-prevention",
	aliases: [],
	parameter: "arguments",
	description: "If you're the channel owner or a channel ambassador, you can use this setting to hide your channel from appearing in the $stalk command's results. Your channel will be displayed as [EXPUNGED], and the last message from your channel will also be obscured.",
	flags: {
		pipe: false,
		elevatedChannelAccess: true // administrative action
	},
	set: async (context, ...args) => {
		await context.channel.setDataProperty("stalkPrevention", true);
		return {
			reply: `Stalk prevention in this channel set successfully.`
		};
	},
	unset: async (context) => {
		await context.channel.setDataProperty("stalkPrevention", null);
		return {
			reply: `Stalk prevention in this channel unset successfully.`
		};
	}
};
