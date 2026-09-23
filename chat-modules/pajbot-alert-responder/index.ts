import { defineChatModule } from "../../classes/chat-module.js";
const ALERT_WORDS = [
	"LARM",
	"POPLACH",
	"ACHTUNG",
	"VARSLING",
	"HÄLYTYS",
	"BÁO ĐỘNG",
	"RIASZTÁS",
	"警報",
	"경고",
	"ТРЕВОГА",
	"تنبيه",
	"ТРИВОГА",
	"ΣΥΝΑΓΕΡΜΟΣ",
	"כוננות",
	"ХӘБӘР"
];

export default defineChatModule({
	name: "pajbot-alert-responder",
	description: "Replies to the 'ALERT' message sent by Pajbot",
	platform: ["twitch"],
	scope: "channel",
	handlers: {
		async message (context) {
			if (context.user?.Name !== "pajbot") {
				return;
			}

			const { message } = context;
			if (!message.includes("pajaS \u{1F6A8} ALERT")) {
				return;
			}

			const word = core.Utils.randArray(ALERT_WORDS);
			const emote = await context.platform.getBestAvailableEmote(context.channel, ["pajaS"], "pajaGIGA");

			await context.channel.send(`${emote} \u{1F6A8} ${word}`, { meAction: true });
		}
	}
});
