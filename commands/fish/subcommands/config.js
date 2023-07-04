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

module.exports = {
	name: "config",
	aliases: ["setup"],
	description: [
		`<code>$fish config whisper on</code>`,
		`<code>$fish config whisper off</code>`,
		"Turns on/off the setting that will whisper people in the current channel when they don't catch a fish.",
		"This is to prevent unwanted spam."
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

			default: return {
				success: false,
				reply: `You provided an unrecognized setting!`
			};
		}
	}
};
