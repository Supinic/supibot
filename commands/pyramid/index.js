module.exports = {
	Name: "pyramid",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Creates a pyramid in chat. Only usable in chats where Supibot is a VIP or a Moderator.",
	Flags: ["developer","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pyramid (context, emote, size) {
		if (!context.channel) {
			return {
				success: false,
				reply: `Cannot use this command in private messages!`
			};
		}
		else if (context.channel.Mode !== "Moderator" && context.channel.Mode !== "VIP") {
			return {
				success: false,
				reply: "Cannot create pyramids in a non-VIP/Moderator chat!"
			};
		}
		else if (!emote) {
			return {
				success: false,
				reply: "No emote provided!"
			};
		}

		size = Number(size);
		if (!sb.Utils.isValidInteger(size)) {
			return {
				success: false,
				reply: `The size of the pyramid must be a positive integer!`
			};
		}

		const limit = context.channel.Message_Limit ?? context.platform.Message_Limit;
		if (emote.repeat(size) > limit || size > 20) {
			return {
				success: false,
				reply: "Target pyramid is either too wide or too tall!"
			};
		}

		emote += " ";

		for (let i = 1; i <= size; i++) {
			context.channel.send(emote.repeat(i));
		}

		for (let i = (size - 1); i > 0; i--) {
			context.channel.send(emote.repeat(i));
		}

		return null;
	}),
	Dynamic_Description: null
};
