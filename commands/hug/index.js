module.exports = {
	Name: "hug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Hugs target user :)",
	Flags: ["opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function hug (context, target) {
		if (!target) {
			return { reply: "You didn't want to hug anyone, so I'll hug you instead 🤗" };
		}
		else if (target.toLowerCase() === context.platform.Self_Name.toLowerCase()) {
			return { reply: "Thanks for the hug 🙂 <3" };
		}
		else {
			return { reply: `${context.user.Name} hugs ${target} 🤗` };
		}
	}),
	Dynamic_Description: null
};
