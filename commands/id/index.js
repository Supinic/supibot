// This number represents Supibot's User_Alias ID.
// With some assumptions, every user with a lower ID is then not considered "first seen" by Supibot,
// since they predate Supibot - and are therefore extrapolated from logs.
const USER_ID_BREAKPOINT = 1127;

export default {
	Name: "id",
	Aliases: ["uid"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks your (or someone else's) ID in the database of users - the lower the number, the earlier the user was first spotted.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
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

		let idString = "That user's ID is";
		let pronoun = "they were";
		if (targetUser.ID === context.user.ID) {
			idString = "Your ID is";
			pronoun = "you were";
		}

		let temporalReply = "first seen";
		if (targetUser.Name === context.platform.Self_Name) {
			temporalReply = "first brought to life as an mIRC bot";
		}
		else if (targetUser.ID < USER_ID_BREAKPOINT) {
			temporalReply = "first mentioned in logs (predating Supibot)";
		}

		const delta = core.Utils.timeDelta(targetUser.Started_Using);
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
