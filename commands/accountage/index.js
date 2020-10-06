module.exports = {
	Name: "accountage",
	Aliases: ["accage"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the Twitch account age of a given account. If none is given, checks yours.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function accountAge (context, user) {
		if (!user) {
			user = context.user.Name;
		}
	
		const { statusCode, body } = await sb.Got.instances.Twitch.V5({
			url: "users",
			throwHttpErrors: false,
			searchParams: new sb.URLParams()
				.set("login", user)
				.toString()
		});
	
		if (statusCode !== 200 || body.users.length === 0) {
			return {
				reply: "That Twitch account has no data associated with them."
			};
		}
	
		const data = body.users[0];
		const now = new sb.Date();
		const created = new sb.Date(data.created_at);
		const delta = sb.Utils.timeDelta(created);
		const pronoun = (user.toLowerCase() === context.user.Name)
			? "Your"
			: "That";
	
		let anniversary = "";
		if (now.year > created.year && now.month === created.month && now.day === created.day) {
			const who = (user.Name === context.platform.Self_Name) ? "my" : "your";
			anniversary = `It's ${who} ${now.year - created.year}. Twitch anniversary! FeelsBirthdayMan Clap`;
		}
	
		return {
			reply: `${pronoun} Twitch account was created ${delta}. ${anniversary}`
		};
	}),
	Dynamic_Description: null
};