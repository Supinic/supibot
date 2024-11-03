const basicRegex = /(get|getting|buy|buying)?\s*(cheap|cheapest|best|real|more)?\s*(viewers|followers)/gi;
const siteRegex = /(streamboo|u\.to|dogehype)/gi;
const discordRegex = /(add\s*)((me on)|(my))\s*(disc(ord)?)/gi;

export const definition = {
	Name: "wanna-become-famous",
	Events: ["message"],
	Description: "Bans various spam or follow bots.",
	Code: (async function wannaBecomeFamous (context) {
		/** @type {Channel} */
		const channelData = context.channel;
		if (channelData.Mode !== "Moderator") {
			return; // cannot time out in non-moderated channels
		}
		else if (channelData.Platform.Name !== "twitch") {
			return; // cannot time out when not on twitch
		}

		let reason = "";
		const msg = sb.Utils.removeAccents(context.message).toLowerCase();
		if (msg.includes("become famous?")) {
			reason = "becoming famous";
		}
		else if (msg.includes("get raided")) {
			reason = "getting raided";
		}
		else if (msg.includes("upgrade your stream")) {
			reason = "upgrading your stream";
		}
		else if (basicRegex.test(msg)) {
			reason = "no more spam";
		}
		else if (siteRegex.test(msg)) {
			reason = "no more site spam";
		}
		else if (discordRegex.test(msg)) {
			reason = "getting added on discord";
		}
		else {
			return;
		}

		/** @type {TwitchPlatform} */
		const platform = channelData.Platform;
		const emote = await channelData.getBestAvailableEmote(
			["NOIDONTTHINKSO", "forsenSmug", "supiniNOIDONTTHINKSO", "RarePepe"],
			"😅",
			{ shuffle: true }
		);

		/** @type {User} */
		const userData = context.user;
		if (!userData && context.raw?.user) {
			const name = context.raw.user;
			await platform.timeout(channelData, name, null, reason);
			await channelData.send(`${emote} ${reason}`);

			return;
		}

		const messageCount = await sb.Query.getRecordset(rs => rs
			.select("Message_Count")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("Channel = %n", context.channel.ID)
			.where("User_Alias = %n", context.user.ID)
			.single()
			.flat("Message_Count")
		);

		if (typeof messageCount === "undefined" || messageCount <= 1) {
			await platform.timeout(channelData, userData, null, reason);
			await channelData.send(`${emote} ${reason} again`);
		}
	}),
	Global: false,
	Platform: null
};
