const hasChannelAdmin = async (context) => {
	if (!context.channel) {
		return {
			success: false,
			reply: `This setting is not available in private messages!`
		};
	}

	const permissions = await context.getUserPermissions();
	if (permissions.flag === sb.User.permissions.regular) {
		return {
			success: false,
			reply: `You're not allowed to change this setting command here! Only administrators, channel owners and ambassadors can.`
		};
	}

	return { success: true };
};

const discordReactionReplies = {
	none: `I will no longer react instead of replying to any kind of fishing.`,
	"fail-only": `I will now react to messages instead of replying, if there is no catch or junk is caught.`,
	all: `I will now react to all messages instead of replying to any kind of fishing.`
};

module.exports = {
	name: "config",
	aliases: ["setup"],
	description: [
		`<code>$fish config whisper on</code>`,
		`<code>$fish config whisper off</code>`,
		"Turns on/off the setting that will whisper people in the current channel when they don't catch a fish.",
		"This is to prevent unwanted spam. As such, only channel owners and ambassadors can change this setting.",
		"",

		`<code>$fish config discord-reactions <u>(type)</u></code>`,
		"Activates a Discord-only setting that will let Supibot react to messages instead of replying with text to signify some kind of fishing result.",
		"Possible settings for <u>type</u>:",
		`<code>none</code> → Disables reactions, Supibot will reply as normal`,
		`<code>fail-only</code> → Supibot will react instead of replying, but only for when nothing is caught, or when junk is caught`,
		`<code>all</code> → Supibot will react instead of replying for all fishing results`
	],
	execute: async (context, type, value) => {
		if (!type) {
			return {
				success: false,
				reply: `When configuring the $fish command, you must provide a type of setting!`
			};
		}

		switch (type.toLowerCase()) {
			case "whisper": {
				const check = await hasChannelAdmin(context);
				if (!check.success) {
					return check;
				}

				const lower = value.toLowerCase();
				if (lower !== "on" && lower !== "off") {
					return {
						success: false,
						reply: `Incorrect value provided! Use either "on" or "off".`
					};
				}

				const fishConfig = await context.channel.getDataProperty("fishConfig") ?? {};
				fishConfig.whisperOnFailure = (lower === "on");
				await context.channel.setDataProperty("fishConfig", fishConfig);

				const string = (lower === "off") ? "no longer" : "now";
				return {
					reply: `I will ${string} whisper people in this channel when they catch junk or nothing, or when they're too early to fish.`
				};
			}

			case "discord-reactions": {
				const check = await hasChannelAdmin(context);
				if (!check.success) {
					return check;
				}
				else if (context.platform.Name !== "discord") {
					return {
						success: false,
						reply: `This setting is only available on Discord!`
					};
				}

				const lower = value.toLowerCase();
				if (lower !== "none" && lower !== "fail-only" && lower !== "all") {
					return {
						success: false,
						reply: `Incorrect value provided! Use either "none", "fail-only" or "all".`
					};
				}

				const fishConfig = await context.channel.getDataProperty("fishConfig") ?? {};
				fishConfig.discordReactionType = lower;
				await context.channel.setDataProperty("fishConfig", fishConfig);

				return {
					reply: discordReactionReplies[lower]
				};
			}

			default: return {
				success: false,
				reply: `You provided an unrecognized setting!`
			};
		}
	}
};
