export default {
	name: "discord",
	aliases: [],
	parameter: "arguments",
	description: "If you're the channel owner or a channel ambassador, you can use this to set the response of the discord command.",
	flags: {
		pipe: false,
		elevatedChannelAccess: true // administrative action
	},
	set: async (context, ...args) => {
		await context.channel.setDataProperty("discord", args.join(" "));
		return {
			reply: `Discord description set successfully.`
		};
	},
	unset: async (context) => {
		await context.channel.setDataProperty("discord", null);
		return {
			reply: `Discord description unset successfully.`
		};
	}
};
