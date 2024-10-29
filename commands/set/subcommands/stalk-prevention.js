module.exports = {
	name: "stalk-prevention",
	aliases: [],
	parameter: "arguments",
	description: "If you're the channel owner or a channel ambassador, you can use this to make your channel not appear in the $stalk command's results. It will be instead shown as [EXPUNGED].",
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
