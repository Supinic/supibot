import { logger } from "../../singletons/logger.js";
import { declare } from "../../classes/command.js";
import type { SupiDate } from "supi-core";

export default declare({
	Name: "lastseen",
	Aliases: ["ls"],
	Cooldown: 5000,
	Description: "For a given user, this command tells you when they were last seen - based on their chat activity.",
	Flags: ["block", "mention", "opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function lastSeen (context, user) {
		if (!user) {
			const emote = await context.randomEmote("FeelsDankMan", "🙂");
			return {
				success: false,
				reply: `${emote} You were last seen: right now!`
			};
		}

		const targetUser = await sb.User.get(user);
		if (!targetUser) {
			return {
				success: false,
				reply: "I have not seen that user before!"
			};
		}
		else if (targetUser.ID === context.user.ID && context.channel) {
			// Only post the "Easter egg" message if used on the executing user in a channel chat
			const emote = await context.randomEmote("PepeLaugh", "pepeLaugh", "LULW", "LuL", "😆");
			return {
				success: false,
				reply: `Oh wow, look at that! You were last seen: Right now! ${emote}`
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emote = await context.randomEmote("supiniStare", "supiniPoint", "monkaStare", "MrDestructoid", "🤖");
			return {
				success: false,
				reply: `${emote} I'm always around!`
			};
		}

		let date: SupiDate | undefined | null = logger.getUserLastSeen(targetUser.ID);
		if (!date) {
			const databaseDate = await core.Query.getRecordset<SupiDate | undefined>(rs => rs
				.select("Last_Message_Posted AS Date")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", targetUser.ID)
				.orderBy("Last_Message_Posted DESC")
				.limit(1)
				.single()
				.flat("Date")
			);
			if (!databaseDate) {
				return {
					success: true,
					reply: core.Utils.tag.trim `
						I have seen this user appear, but they never showed up in chat.
						They were first spotted ${core.Utils.timeDelta(targetUser.Started_Using)}.
					`
				};
			}

			date = databaseDate;
		}

		const who = (context.user === targetUser) ? "You were" : "That user was";
		return {
			success: true,
			reply: `${who} last seen in chat ${core.Utils.timeDelta(date)}.`
		};
	}),
	Dynamic_Description: null
});
