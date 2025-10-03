import type {
	ChatModuleDefinition,
	GenericMessageEventData,
	TwitchMessageEventData
} from "../../classes/chat-module.js";
import type { TwitchPlatform } from "../../platforms/twitch.js";
import type { User } from "../../classes/user.js";
import { SupiError } from "supi-core";
import { ivrUserDataSchema } from "../../utils/schemas.js";

type UserAliasRow = Pick<User, "Discord_ID" | "Twitch_ID" | "Name">;

type ReplyData = TwitchMessageEventData["messageData"]["reply"];

const isTwitchEvent = (eventData: GenericMessageEventData): eventData is TwitchMessageEventData => (eventData.platform.name === "twitch");

const keywords = new Set(["sus", "username", "account", "supibot", "help", "flag", "remedy"]);
const alreadySelfCheckedUsernames: Set<string> = new Set();
const isMessageSelfCheck = (username: string, message: string) => {
	if (alreadySelfCheckedUsernames.has(username)) {
		return false;
	}

	const lower = message.toLowerCase();
	for (const keyword of keywords) {
		if (lower.includes(keyword)) {
			return true;
		}
	}

	return false;
};

const replyIdUserMap: Map<string, string> = new Map();
const isMessageCheckReply = (username: string, reply: ReplyData) => {
	if (!reply) {
		return false;
	}

	const messageId = replyIdUserMap.get(username);
	if (!messageId) {
		return false;
	}

	return (messageId === reply.parent_message_id);
};

export default {
	Name: "suspicious-user-auto-check",
	Events: ["message"],
	Description: "For each user who types (a part of) the \"suspicious user\" message, this module will automatically try the $$suscheck alias.",
	Code: (async function suspiciousUserAutoChecker (eventData) {
		if (!isTwitchEvent(eventData)) {
			return;
		}

		const { channel, message, raw, user, platform, messageData } = eventData;
		if (!channel || channel.Mode === "Read") {
			return;
		}
		else if (user) {
			// Immediately return if the user is **NOT** suspicious
			// If the user object is present, then immediately return - suspicious users will be seen as "raw" instead
			return;
		}

		if (isMessageSelfCheck(raw.user, message)) {
			alreadySelfCheckedUsernames.add(raw.user);

			const assumedUserID = await core.Query.getRecordset<string | undefined>(rs => rs
				.select("Twitch_ID")
				.from("chat_data", "User_Alias")
				.where("Name = %s", raw.user)
				.flat("Twitch_ID")
				.single()
				.limit(1)
			);
			if (!assumedUserID) {
				await channel.send(`Could not find user ${raw.user} in the database for Twitch_ID!`);
				return;
			}

			const response = await core.Got.get("IVR")({
				url: "v2/twitch/user",
				searchParams: {
					id: assumedUserID
				}
			});

			if (!response.ok || response.body.length === 0) {
				await channel.send(`Could not check @${raw.user} for suspiciousness!`);
				return;
			}

			const [data] = ivrUserDataSchema.parse(response.body);
			if (data.login === raw.user) {
				const logID = await sb.Logger.log(
					"Twitch.Warning",
					`Weird suspicious case: ${JSON.stringify({ data, assumedUserID })}`
				);

				await channel.send(`It seems like @${raw.user} is not suspicious at all...! Something probably went wrong. @Supinic check Log ID ${logID} pleae`);
				return;
			}

			const resultMessage = core.Utils.tag.trim `
				Hey @${raw.user}, I'd like to verify whether @${data.login} 
				is a different account/name that you used in the past, or if it belongs to someone else.
				Reply to this message with "me" or "not me" accordingly - use the Reply function in Twitch chat.
			`;

			const messageResult = await (platform as TwitchPlatform).send(resultMessage, channel);
			if (messageResult.success) {
				replyIdUserMap.set(raw.user, messageResult.messageId);
			}
		}
		else if (isMessageCheckReply(raw.user, messageData.reply)) {
			const lower = message
				.toLowerCase()
				.replace(/^\s*@\w+\s*/, "") // Replaces any @ mentions at the start of the message
				.replaceAll(/[^a-z ]/g, "") // Removes all non-letter (+ space) characters
				.trim();

			if (lower !== "me" && lower !== "not me") {
				await channel.send(`Please reply to the original message with specifically "me" or "not me"!`);
				return;
			}

			const userId = await core.Query.getRecordset<string | undefined>(rs => rs
				.select("ID")
				.from("chat_data", "User_Alias")
				.where("Name = %s", raw.user)
				.limit(1)
				.single()
				.flat("ID")
			);

			if (!userId) {
				throw new SupiError({
				    message: "Assert error: Suspicious-checked user ID does not exist",
					args: { raw }
				});
			}

			const row = await core.Query.getRow<UserAliasRow>("chat_data", "User_Alias");
			await row.load(userId);

			let description: string;
			if (lower === "me") {
				description = `Twitch_ID: ${row.values.Twitch_ID} -> ${raw.userId}`;
				row.setValues({ Twitch_ID: raw.userId });
			}
			else {
				description = `Name: ${row.values.Name} -> _INACTIVE_${row.values.Name}`;
				row.setValues({ Name: `_INACTIVE_${row.values.Name}}` });
			}

			const json = JSON.stringify({ description, raw, reply: messageData.reply }, null, 4);
			await sb.Logger.log(
				"Twitch.Other",
				`TEST! Automatic suspicious user resolution: ${json}`,
				channel,
				null
			);

			await row.save({ skipLoad: true });
			await sb.User.invalidateUserCache(raw.user);

			await channel.send(`Success 🥳 Make sure to try using a command before you leave to confirm everything is okay.`);
			replyIdUserMap.delete(raw.user);
		}
	}),
	Global: false,
	Platform: null
} satisfies ChatModuleDefinition;
