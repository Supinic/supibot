const flagDisplayNames = {
	instagramNSFW: "Instagram",
	redditNSFW: "Reddit",
	twitchLottoNSFW: "TwitchLotto",
	twitterNSFW: "Twitter"
};

const setChannelFlag = async (context, flagName, flagValue) => {
	const { channel } = context;
	if (!channel) {
		return {
			success: false,
			reply: "You can't set any settings without being in a channel!"
		};
	}

	const permissions = await context.getUserPermissions();
	if (permissions.flag === sb.User.permissions.regular) {
		return {
			success: false,
			reply: "You don't have access to this channel's settings! Only administrators, channel owners and ambassadors can."
		};
	}

	const string = (flagValue) ? "set" : "unset";
	const currentFlag = await context.channel.getDataProperty(flagName);
	if ((typeof currentFlag === "undefined" && !flagValue) || currentFlag === flagValue) {
		return {
			success: false,
			reply: `This channel's ${flagDisplayNames[flagName]} NSFW flag is already ${string}!`
		};
	}

	await context.channel.setDataProperty(flagName, flagValue);
	return {
		reply: `Successfully ${string} this channel's ${flagDisplayNames[flagName]} NSFW.`
	};
};

export default [
	{
		name: "instagram-nsfw",
		aliases: ["rig-nsfw"],
		parameter: "arguments",
		description: `If you are the channel ambassador/owner, you can decide whether or not your channel will filter out NSFW Instagram links in the random Instagram ($rig) command.`,
		flags: {
			pipe: false
		},
		set: async (context) => await setChannelFlag(context, "instagramNSFW", true),
		unset: async (context) => await setChannelFlag(context,"instagramNSFW", false)
	},
	{
		name: "reddit-nsfw",
		aliases: ["rm-nsfw"],
		parameter: "arguments",
		description: `If you are the channel ambassador/owner, you can decide whether or not your channel will filter out NSFW Reddit links in the random Reddit ($rm) command.`,
		flags: {
			pipe: false
		},
		set: async (context) => await setChannelFlag(context, "redditNSFW", true),
		unset: async (context) => await setChannelFlag(context,"redditNSFW", false)
	},
	{
		name: "twitch-lotto-nsfw",
		aliases: ["twitchlotto-nsfw", "tl-nsfw"],
		parameter: "arguments",
		description: `If you are the channel ambassador/owner, you can decide whether or not your channel will filter out NSFW TwitchLotto links in the $twitchlotto command.`,
		flags: {
			pipe: false
		},
		set: async (context) => await setChannelFlag(context, "twitchLottoNSFW", true),
		unset: async (context) => await setChannelFlag(context,"twitchLottoNSFW", false)
	},
	{
		name: "twitter-nsfw",
		aliases: ["tweet-nsfw"],
		parameter: "arguments",
		description: `If you are the channel ambassador/owner, you can decide whether or not your channel will filter out NSFW Twitter links in the $twitter command.`,
		flags: {
			pipe: false
		},
		set: async (context) => await setChannelFlag(context, "twitterNSFW", true),
		unset: async (context) => await setChannelFlag(context,"twitterNSFW", false)
	}
];
