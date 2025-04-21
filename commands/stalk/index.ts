import { SupiDate, SupiError } from "supi-core";
import type { Context, CommandDefinition } from "../../classes/command.js";
import type { IvrUserData } from "../../@types/globals.js";

const omittedBanReasons = new Set(["TOS_TEMPORARY", "TOS_INDEFINITE"]);

export default {
	Name: "stalk",
	Aliases: null,
	Cooldown: 5000,
	Description: "For a given user, attempts to find the message they last sent in chat, plus the channel and time when they posted it.",
	Flags: ["block","external-input","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function stalk (context: Context<[]>, user) {
		if (!user) {
			const emote = await context.getBestAvailableEmote(["forsen1"], "👀");
			return {
				success: false,
				reply: `${emote} I'm watching you... (no user provided!)`
			};
		}

		const targetUser = await sb.User.get(user);
		if (!targetUser) {
			return {
				success: false,
				reply: "User not found in the database!"
			};
		}
		else if (targetUser.ID === context.user.ID && context.channel) {
			// Only post the "Easter egg" message if used on the executing user in a channel chat
			const emote = await context.randomEmote("forsen1", "👀");
			return {
				success: false,
				reply: `${emote} You're right here ${emote}`
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emote = await context.randomEmote("MrDestructoid", "🤖");
			return {
				success: false,
				reply: `${emote} I'm right here ${emote}`
			};
		}

		type StalkData = { Text: string, Date: SupiDate, ChannelID: number };
		const stalkData = await core.Query.getRecordset<StalkData | undefined>(rs => rs
			.select("Last_Message_Text AS Text", "Last_Message_Posted AS Date", "Channel.ID AS ChannelID")
			.from("chat_data", "Message_Meta_User_Alias")
			.join("chat_data", "Channel")
			.where("User_Alias = %n", targetUser.ID)
			.orderBy("Last_Message_Posted DESC")
			.limit(1)
			.single()
		);

		if (!stalkData) {
			return {
				reply: core.Utils.tag.trim `
					That user is in the database, but never showed up in chat.
					They were first spotted ${core.Utils.timeDelta(targetUser.Started_Using)}.
				`
			};
		}

		const stalkChannelData = sb.Channel.get(stalkData.ChannelID);
		if (!stalkChannelData) {
			throw new SupiError({
				message: "Assert error: Stalked channel ID is not available",
				args: { stalkData }
			});
		}

		// Automated protection of the bot from being banned:
		// Do not allow stalking of banned Twitch users in Twitch channels - available in Twitch whispers and other platforms.
		if (targetUser.Twitch_ID && context.platform.Name === "twitch" && context.channel && stalkChannelData.Platform.Name === "twitch") {
			const response = await core.Got.get("IVR")<IvrUserData[] | undefined>({
				url: "v2/twitch/user",
				searchParams: {
					id: targetUser.Twitch_ID
				}
			});

			// Only refuse to send the message if the ban type ("reason") is a TOS violation.
			// Memo: possibly also refuse to send when type is `DEACTIVATED`?
			const userInfo = response.body?.[0];
			if (userInfo && userInfo.banned && omittedBanReasons.has(userInfo.banReason)) {
				return {
					success: false,
					reply: "You cannot stalk that user as they're currently banned on Twitch!"
				};
			}
		}

		const delta = core.Utils.timeDelta(stalkData.Date);
		const who = (context.user === targetUser)
			? "You were"
			: "That user was";

		let channelString = stalkChannelData.getFullName();
		let messageString = stalkData.Text;
		const isStalkPrevented = await stalkChannelData.getDataProperty("stalkPrevention");
		if (isStalkPrevented) {
			channelString = `${stalkChannelData.Platform.name}-[EXPUNGED]`;
			messageString = "[EXPUNGED]";
		}

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			partialReplies: [
				{
					bancheck: true,
					message: who
				},
				{
					bancheck: false,
					message: `last seen in chat ${delta} (${channelString}) Last message:`
				},
				{
					bancheck: true,
					message: messageString
				}
			]
		};
	}),
	Dynamic_Description: null
} satisfies CommandDefinition;
