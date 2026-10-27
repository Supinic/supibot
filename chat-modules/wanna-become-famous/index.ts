import { logger } from "../../singletons/logger.ts";
import { defineChatModule } from "../../classes/chat-module.ts";

const basicRegex = /(get|getting|buy|buying)?\s*(cheap|cheapest|best|real|more)?\s*(viewers|followers)/gi;
const siteRegex = /(streamboo|u\.to|dogehype)/gi;
const discordRegex = /(add\s*)((me on)|(my))\s*(disc(ord)?)/gi;
const mathSymbolRegex = /[\u{1D400}-\u{1D7FF}]/gu;

export default defineChatModule({
	name: "wanna-become-famous",
	description: "Bans various spam or follow bots.",
	scope: "channel",
	platform: ["twitch"],
	handlers: {
		async message (context) {
			const { channel, message, platform, user, raw } = context;
			if (channel.Mode !== "Moderator") {
				return; // cannot time out in non-moderated channels
			}

			let reason;
			const msg = core.Utils.removeAccents(message).toLowerCase();
			const mathCharacters = [...msg.matchAll(mathSymbolRegex)].length;

			if (msg.includes("become famous?")) {
				reason = "becoming famous";
			}
			else if (msg.includes("the void")) {
				reason = "advertising into the void";
			}
			else if (msg.includes("get raided")) {
				reason = "getting raided";
			}
			else if (msg.includes("upgrade your stream")) {
				reason = "upgrading your stream";
			}
			else if (msg.includes("stream promotion")) {
				reason = "promoting your stream";
			}
			else if (msg.includes(".ru")) {
				reason = "being suspicious";
			}
			else if (msg.includes("ai") && msg.includes("view")) {
				reason = "vibe coding an audience";
			}
			else if (msg.includes("ꜰᴏʟʟᴏᴡ ʏᴏᴜ") || msg.includes("ꜰᴇʟʟᴏᴡ ꜱᴛʀᴇᴀᴍᴇʀ")) {
				reason = "yoo buddy";
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
			else if (mathCharacters > 3) {
				reason = "posting sus text";
			}
			else {
				return;
			}

			const emote = await platform.getBestAvailableEmote(
				channel,
				["NOIDONTTHINKSO", "forsenSmug", "supiniNOIDONTTHINKSO", "RarePepe"],
				"😅",
				{ shuffle: true }
			);

			let name;
			if (!user && raw?.user) {
				name = raw.user;
			}
			else if (user) {
				const messageCount = await core.Query.getRecordset<number | undefined>(rs => rs
					.select("Message_Count")
					.from("chat_data", "Message_Meta_User_Alias")
					.where("Channel = %n", channel.ID)
					.where("User_Alias = %n", user.ID)
					.single()
					.flat("Message_Count")
				);

				if (typeof messageCount === "undefined" || messageCount <= 1) {
					name = user.Name;
				}
			}

			if (name) {
				await Promise.all([
					platform.timeout(channel, name, null, reason),
					channel.send(`${emote} ${reason}`),
					logger.log("Twitch.Ban", `Wanna become famous: "${message}"`, channel, user)
				]);
			}
		}
	}
});
