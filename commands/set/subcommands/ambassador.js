const handleAmbassadors = async (type, context, ...args) => {
	const [user, channel = context.channel?.Name] = args;
	if (!user || !channel) {
		return {
			success: false,
			reply: `Must provide a proper user and channel!`
		};
	}

	const userData = await sb.User.get(user);
	const channelData = sb.Channel.get(channel, context.platform);
	if (!userData || !channelData) {
		return {
			success: false,
			reply: `Either the channel or the user have not been found!`
		};
	}
	else if (type === "set" && userData.Name === channelData.Name) {
		return {
			success: false,
			reply: "Channel owners can't be set as their own channel's ambassadors!"
		};
	}

	const isAmbassador = await channelData.isUserAmbassador(userData);
	if ((type === "set" && isAmbassador) || (type === "unset" && !isAmbassador)) {
		const prefix = (type === "set") ? "already" : "not";
		return {
			success: false,
			reply: `Cannot ${context.invocation} ${userData.Name} as an ambassador in ${channelData.Name}, because they are ${prefix} one!`
		};
	}

	await channelData.toggleAmbassador(userData);

	if (type === "set") {
		const message = sb.Utils.tag.trim `
					You are now a Supibot Ambassador in the channel ${channelData.Name}!
					This means you can use some commands as if you were the channel owner, such as "ban" - check its help!
					You should also notify @Supinic whenever there's an issue, or something needs to be fixed or done regarding the bot.
					Have fun and stay responsible 🙂
				`;

		try {
			await context.platform.pm(message, userData.Name);
		}
		catch {
			const selfBotUserData = await sb.User.get(context.platform.Self_Name);
			await sb.Reminder.create({
				User_From: selfBotUserData.ID,
				User_To: userData.ID,
				Platform: context.platform.ID,
				Channel: context.channel.ID,
				Schedule: null,
				Text: message,
				Private_Message: false
			}, true);
		}
	}

	const string = (type === "set") ? "now" : "no longer";
	return {
		reply: `${userData.Name} is ${string} a Supibot Ambassador in #${channelData.Name}.`
	};
};

module.exports = {
	name: "ambassador",
	aliases: [],
	description: `Designates a user as an "Ambassador" in a specific channel, which grants them elevated access to some Supibot commands.`,
	parameter: "arguments",
	flags: {
		ownerOnly: true,
		pipe: false
	},
	set: (context, ...args) => handleAmbassadors("set", context, ...args),
	unset: (context, ...args) => handleAmbassadors("unset", context, ...args)
};
