module.exports = {
	Name: "id",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Checks your (or someone else's) ID in the database of users - the lower the number, the earlier the user was first spotted",
	Flags: ["mention","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: ({
		threshold: 1127
	}),
	Code: (async function id (context, user) {
		let targetUser = context.user;
		if (user) {
			targetUser = await sb.Utils.getDiscordUserDataFromMentions(user, context.append) || await sb.User.get(user, true);
		}
	
		if (!targetUser) {
			return { reply: "No data for given user name!" };
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
			: (targetUser.ID < this.staticData.botID)
				? "first mentioned in logs (predating Supibot)"
				: "first seen";
	
		const delta = sb.Utils.timeDelta(targetUser.Started_Using);
		const now = new sb.Date();
		const { year, month, day } = new sb.Date(targetUser.Started_Using);
	
		let birthdayString = "";
		if (now.year > year && now.month === month && now.day === day) {
			if (targetUser.Name === context.platform.Self_Name) {
				birthdayString = "It's my birthday! FeelsBirthdayMan MrDestructoid";
			}
			else {
				birthdayString = `It's your account's ${now.year - year}. anniversary in my database! FeelsBirthdayMan Clap`;
			}
		}
	
		return {
			reply: `${idString} ${targetUser.ID} and ${pronoun} ${temporalReply} ${delta}. ${birthdayString}`
		};
	}),
	Dynamic_Description: null
};