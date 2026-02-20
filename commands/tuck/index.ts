import { declare } from "../../classes/command.js";

export default declare({
	Name: "tuck",
	Aliases: ["fuck", "gnkiss", "headpat", "hug", "truck"],
	Cooldown: 10000,
	Description: "Tucks target user to bed.",
	Flags: ["block", "opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function tuck (context, user?: string, ...args: string[]) {
		const username = sb.User.normalizeUsername(user ?? context.user.Name);
		const emote = args.pop() ?? null;

		const checkUser = username.toLowerCase();
		const sadEmote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "peepoSad", "FeelsBadMan"], "😢");

		// @todo remove this type cast when context.invocation is a specific union in the future
		const invocation = context.invocation as "tuck" | "fuck" | "gnkiss" | "headpat" | "hug" | "truck";
		switch (invocation) {
			case "fuck": {
				if (checkUser === context.user.Name || checkUser === "me") {
					return {
						success: true,
						reply: "There are toys made for that, you know..."
					};
				}
				else if (checkUser === "you") {
					return {
						success: true,
						reply: "Fuck you, leather man..."
					};
				}
				else if (checkUser === context.platform.Self_Name.toLowerCase()) {
					return {
						success: true,
						reply: "Hey buddy, I think you got the wrong door."
					};
				}
				else {
					const gachiEmote = await context.getBestAvailableEmote(
						["gachiHYPER", "gachiBASS", "gachiGASM", "gachiPRIDE"],
						"🔞"
					);

					return {
						success: true,
						reply: `You fucked ${username}'s brains out ${emote ?? gachiEmote}`
					};
				}
			}

			case "gnkiss": {
				if (checkUser === context.user.Name) {
					return {
						success: true,
						reply: `You had nobody to kiss you good night, so you cry yourself to sleep ${sadEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						success: true,
						reply: "Thanks for the kiss, but I gotta stay up 🙂"
					};
				}
				else {
					const forehead = (emote?.toLowerCase().includes("head"))
						? emote
						: await context.getBestAvailableEmote(["4HEad", "4Head"], "forehead");

					return {
						success: true,
						reply: `You bid ${username} good night and gently kiss their ${forehead}`
					};
				}
			}

			case "headpat": {
				if (checkUser === context.user.Name) {
					return {
						success: true,
						reply: "You pat yourself on the head... okay?"
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						success: true,
						reply: "Thank you 😳"
					};
				}
				else {
					if (emote === "4Head") {
						return {
							success: true,
							reply: `You gently pat ${username} on the ${emote}`
						};
					}

					return {
						success: true,
						reply: `You gently pat ${username} on the head ${emote ?? "🙂"}`
					};
				}
			}

			case "hug": {
				if (checkUser === context.user.Name) {
					return {
						success: true,
						reply: "You didn't want to hug anyone, so I'll hug you instead 🤗"
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						success: true,
						reply: "Thanks for the hug 🙂 <3"
					};
				}
				else {
					return {
						success: true,
						reply: `${context.user.Name} hugs ${username} 🤗`
					};
				}
			}

			case "truck": {
				const kkonaEmote = await context.getBestAvailableEmote(["KKoooona", "KKonaW", "KKona"], "🤠");
				if (checkUser === context.user.Name) {
					return {
						success: true,
						reply: `The truck ran you over ${kkonaEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						success: true,
						reply: `${kkonaEmote} I'M DRIVING THE TRUCK ${kkonaEmote} GET OUT OF THE WAY ${kkonaEmote}`
					};
				}
				else {
					return {
						success: true,
						reply: `You truck ${username} into bed with the power of a V8 engine ${kkonaEmote} 👉🛏🚚`
					};
				}
			}

			case "tuck": {
				const okayEmote = await context.getBestAvailableEmote(["supiniOkay", "FeelsOkayMan"], "😊");
				if (checkUser === context.user.Name) {
					return {
						success: true,
						reply: `You had nobody to tuck you in, so you tucked yourself in ${sadEmote}`
					};
				}
				else if (checkUser === context.platform.Self_Name) {
					return {
						success: true,
						reply: "Thanks for the kind gesture, but I gotta stay up 🙂"
					};
				}
				else {
					return {
						success: true,
						reply: `You tucked ${username} to bed ${emote ?? okayEmote} 👉 🛏`
					};
				}
			}
		}
	},
	Dynamic_Description: () => [
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
		"Bids target user goodnight and kiss their forehead.",
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
});
