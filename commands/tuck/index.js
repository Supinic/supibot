module.exports = {
	Name: "tuck",
	Aliases: ["gnkiss","headpat"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Tucks target user to bed",
	Flags: ["opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function tuck (context, user, ...args) {
		const emote = args.pop() ?? null;

		user = user.replace(/^@/, "");
		const checkUser = user?.toLowerCase() ?? null;
	
		if (context.invocation === "tuck") {
			if (!checkUser || checkUser === context.user.Name) {
				return { 
					reply: "You had nobody to tuck you in, so you tucked yourself in PepeHands" 
				};
			}
			else if (checkUser === context.platform.Self_Name) {
				return { 
					reply: "Thanks for the kind gesture, but I gotta stay up :)" 
				};
			}
			else {
				return { 
					reply: `You tucked ${user} to bed ${emote ?? "FeelsOkayMan"} 👉 🛏`
				};
			}
		}
		else if (context.invocation === "gnkiss") {
			if (!checkUser || checkUser === context.user.Name) {
				return { 
					reply: "You had nobody to kiss you good night, so you cry yourself to sleep PepeHands" 
				};
			}
			else if (checkUser === context.platform.Self_Name) {
				return { 
					reply: "Thanks for the kiss, but I gotta stay up :)"
				};
			}
			else {
				const forehead = (emote?.toLowerCase().includes("head"))
					? emote
					: "4Head";
	
				return { 
					reply: `You bid ${user} good night and gently kiss their ${forehead}`
				};
			}
		}
		else if (context.invocation === "headpat") {
			if (!checkUser || checkUser === context.user.Name) {
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
	}),
	Dynamic_Description: null
};