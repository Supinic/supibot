let channelList;
const getKey = (id) => `twitch-bot-scope-reminder-notified-${id}`;
const createMessage = (name) => sb.Utils.tag.trim `
	Hey @${name}, it seems like you used to have me in your channel.
	However, since June 26th 2024, I need to either have your permission or be a moderator to stay in your channel (or both).
	You can permit me here: https://supinic.com/bot/twitch-auth/
	After you're done, use this command to get me back: $bot rejoin channel:${name}
`;

export default {
	Name: "twitch-bot-scope-reminder",
	Events: ["message"],
	Description: "Notifies users that used to have Supibot but didn't permit it within the crossover window.",
	Code: (async function remindTwitchBotScope (context) {
		const { channel, message, user } = context;
		if (!user) {
			return;
		}
		else if (!message.toLowerCase().includes("bot")) {
			return;
		}

		const userId = user.Twitch_ID;
		const cacheKey = getKey(userId);
		const alreadyNotified = await sb.Cache.getByPrefix(cacheKey);
		if (alreadyNotified) {
			return;
		}

		// channelList ??= await sb.Query.getRecordset(rs => rs
		// 	.select("Channel.Specific_ID")
		// 	.from("chat_data", "Channel_Data")
		// 	.join("chat_data", "Channel")
		// 	.where("Property = %s", "twitchNoScopeDisabled")
		// 	.where("Value = %s", "true")
		// 	.where("Mode = %s", "Inactive")
		// 	.groupBy("Specific_ID")
		// 	.flat("Specific_ID")
		// );

		channelList = ["31400525"];

		if (!channelList.includes(userId)) {
			return;
		}

		await sb.Cache.setByPrefix(cacheKey, true, {
			expiry: 7 * 864e5 // 7 days
		});

		const notificationMessage = createMessage(user.Name);
		await channel.send(notificationMessage);
	}),
	Global: false,
	Platform: null
};
