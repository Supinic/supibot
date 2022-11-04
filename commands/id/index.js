module.exports = {
	Name: "id",
	Aliases: ["uid"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks your (or someone else's) ID in the database of users - the lower the number, the earlier the user was first spotted.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		threshold: 1127
	})),
	Code: (async function id (context, user) {
		const targetUser = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "No data for given user name!"
			};
		}

		let idString = "That person's ID is";
		let pronoun = "they were";
		if (sb.User.bots.has(targetUser.ID)) {
			idString = "That bot's ID is";
			pronoun = "it was";
		}
		else if (targetUser.ID === context.user.ID) {
			idString = "Your ID is";
			pronoun = "you were";
		}

		const temporalReply = (targetUser.Name === context.platform.Self_Name)
			? "first brought to life as an mIRC bot"
			: ((targetUser.ID < this.staticData.botID)
				? "first mentioned in logs (predating Supibot)"
				: "first seen");

		const delta = sb.Utils.timeDelta(targetUser.Started_Using);
		const now = new sb.Date();
		const { year, month, day } = new sb.Date(targetUser.Started_Using);

		let birthdayString = "";
		if (now.year > year && now.month === month && now.day === day) {
			const birthdayFace = await context.getBestAvailableEmote(["FeelsBirthdayMan"], "🥳");
			const robotFace = await context.getBestAvailableEmote(["MrDestructoid"], "🤖");
			const sideEmote = await context.getBestAvailableEmote(["Clap"], "🎈");

			if (targetUser.Name === context.platform.Self_Name) {
				birthdayString = `It's my birthday! ${birthdayFace} ${robotFace}`;
			}
			else {
				const who = (targetUser === context.user) ? "your" : "their";
				birthdayString = `It's ${who} account's ${now.year - year}. anniversary in my database! ${birthdayFace} ${sideEmote}`;
			}
		}

		const platformIdArray = [];
		if (targetUser.Twitch_ID) {
			platformIdArray.push(`Twitch ID: ${targetUser.Twitch_ID}`);
		}
		if (targetUser.Discord_ID) {
			platformIdArray.push(`Discord ID: ${targetUser.Discord_ID}`);
		}

		const platformIdString = platformIdArray.join("; ");
		return {
			reply: `${idString} ${targetUser.ID} and ${pronoun} ${temporalReply} ${delta}. ${platformIdString} ${birthdayString}`
		};
	}),
	Dynamic_Description: null
};
