module.exports = {
	Name: "accountage",
	Aliases: ["accage"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the Twitch account age of a given account. If none is given, checks yours.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function accountAge (context, user) {
		const login = sb.User.normalizeUsername(user ?? context.user.Name).toLowerCase();
		const response = await sb.Got.get("IVR")({
			url: "v2/twitch/user",
			searchParams: { login }
		});

		if (response.statusCode !== 200 || response.body.length === 0) {
			return {
				reply: "That Twitch account has no data associated with them."
			};
		}

		const creationDate = response.body[0].createdAt;
		const created = new sb.Date(creationDate);
		const delta = sb.Utils.timeDelta(created, false, true);
		const pronoun = (login.toLowerCase() === context.user.Name) ? "Your" : "Their";

		let anniversary = "";
		const now = new sb.Date();
		if (now.year > created.year && now.month === created.month && now.day === created.day) {
			const who = (login === context.platform.Self_Name) ? "my" : pronoun.toLowerCase();

			anniversary = `It's ${who} ${now.year - created.year}. Twitch anniversary! FeelsBirthdayMan Clap`;
		}

		return {
			reply: `${pronoun} Twitch account was created ${delta}. ${anniversary}`
		};
	}),
	Dynamic_Description: null
};
