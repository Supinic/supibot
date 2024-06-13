module.exports = {
	Name: "tuck",
	Aliases: ["fuck","gnkiss","headpat","hug","truck"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Tucks target user to bed.",
	Flags: ["block","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: async function tuck (context, user, ...args) {
		user ??= context.user.Name;

		const emote = args.pop() ?? null;
		user = user.replace(/^@/, "");

		const checkUser = user.toLowerCase() ?? null;
		const sadEmote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "peepoSad", "FeelsBadMan"], "😢");

		switch (context.invocation) {
			case "fuck": {
				if (checkUser === context.user.Name || checkUser === "me") {
					return {
						reply: "There are toys made for that, you know..."
					};
				}
				else if (checkUser === "you") {
					return {
						reply: "Fuck you, leather man..."
					};
				}
				else if (checkUser === context.platform.Self_Name.toLowerCase()) {
					return {
						reply: "Hey buddy, I think you got the wrong door."
					};
				}
				else {
					const gachiEmote = await context.getBestAvailableEmote(
						["gachiHYPER", "gachiBASS", "gachiGASM", "gachiPRIDE"],
						"🔞"
					);

					return {
						reply: `You fucked ${user}'s brains out ${emote ?? gachiEmote}`
					};
				}
			}

			case "gnkiss": {
				if (checkUser === context.user.Name) {
					return {
						reply: `You had nobody to kiss you good night, so you cry yourself to sleep ${sadEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						reply: "Thanks for the kiss, but I gotta stay up 🙂"
					};
				}
				else {
					const forehead = (emote?.toLowerCase().includes("head"))
						? emote
						: await context.getBestAvailableEmote(["4HEad", "4Head"], "forehead");

					return {
						reply: `You bid ${user} good night and gently kiss their ${forehead}`
					};
				}
			}

			case "headpat": {
				if (checkUser === context.user.Name) {
					return {
						reply: "You pat yourself on the head... okay?"
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						reply: "Thank you 😳"
					};
				}
				else {
					if (emote === "4Head") {
						return {
							reply: `You gently pat ${user} on the ${emote}`
						};
					}

					return {
						reply: `You gently pat ${user} on the head ${emote ?? "🙂"}`
					};
				}
			}

			case "hug": {
				if (checkUser === context.user.Name) {
					return {
						reply: "You didn't want to hug anyone, so I'll hug you instead 🤗"
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						reply: "Thanks for the hug 🙂 <3"
					};
				}
				else {
					return {
						reply: `${context.user.Name} hugs ${user} 🤗`
					};
				}
			}

			case "truck": {
				const kkonaEmote = await context.getBestAvailableEmote(["KKoooona", "KKonaW", "KKona"], "🤠");
				if (checkUser === context.user.Name) {
					return {
						reply: `The truck ran you over ${kkonaEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						reply: `${kkonaEmote} I'M DRIVING THE TRUCK ${kkonaEmote} GET OUT OF THE WAY ${kkonaEmote}`
					};
				}
				else {
					return {
						reply: `You truck ${user} into bed with the power of a V8 engine ${kkonaEmote} 👉🛏🚚`
					};
				}
			}

			case "tuck": {
				const okayEmote = await context.getBestAvailableEmote(["supiniOkay", "FeelsOkayMan"], "😊");
				if (checkUser === context.user.Name) {
					return {
						reply: `You had nobody to tuck you in, so you tucked yourself in ${sadEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						reply: "Thanks for the kind gesture, but I gotta stay up 🙂"
					};
				}
				else {
					return {
						reply: `You tucked ${user} to bed ${emote ?? okayEmote} 👉 🛏`
					};
				}
			}
		}
	},
	Dynamic_Description: async () => [
		"For a provided user, you can either tuck, truck, fuck, headpat or kiss them goodnight.",
		"It all depends on your relationship.",
		"",

		"<code>$tuck (user)</code>",
		"Tucks target user to bed.",
		"",

		"<code>$fuck (user)</code>",
		"Fucks target user to bed.",
		"",

		"<code>$gnkiss (user)</code>",
		"Bids t$arget user goodnight and kiss their forehead.",
		"",

		"<code>$headpat (user)</code>",
		"Gently pats target user on the head.",
		"",

		"<code>$hug (user)</code>",
		"Hugs target user.",
		"",

		"<code>$truck (user)</code>",
		"Trucks target user to bed."
	]
};
