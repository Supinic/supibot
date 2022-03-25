module.exports = {
	Name: "fuck",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fucks target user to bed.",
	Flags: ["mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function fuck (context, user, emote) {
		let randomString = "";
		if (!user) {
			randomString = "randomly";
			user = sb.Utils.randArray([...sb.User.data.values()]).Name;
		}

		user = user.toLowerCase();

		if (user === context.user.Name || user === "me") {
			return {
				reply: "There are toys made for that, you know..."
			};
		}
		else if (user === "you") {
			return {
				reply: "Fuck you, leather man..."
			};
		}
		else if (user === context.platform.Self_Name.toLowerCase()) {
			return {
				reply: "Hey buddy, I think you got the wrong door."
			};
		}
		else {
			const defaultEmote = await context.getBestAvailableEmote(
				["gachiHYPER", "gachiBASS", "gachiGASM", "gachiPRIDE"],
				"🔞"
			);

			return {
				reply: `You ${randomString} fucked ${user}'s brains out ${emote ?? defaultEmote}`
			};
		}
	}),
	Dynamic_Description: null
};
