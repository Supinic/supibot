import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "chat-suggestion-linker",
	description: "If a Supibot suggestion ID format is detected, posts a link to it - plus a github link, if the suggestion has one.",
	scope: "channel",
	platform: "all",
	handlers: {
		message: (async function linkChatSuggestions (context) {
			const { channel, message } = context;
			const match = message.match(/\bS#(\d+)\b/i);
			if (!match) {
				return;
			}

			const ID = Number(match[1]);
			if (!core.Utils.isValidInteger(ID)) {
				return;
			}

			const data = await core.Query.getRecordset<{ ID: number; link: string | null; } | undefined>(rs => rs
				.select("ID", "Github_Link AS link")
				.from("data", "Suggestion")
				.where("ID = %n", ID)
				.single()
			);
			if (!data) {
				return;
			}

			const now = SupiDate.now();
			const key = `bot-faq-helper-timeout-${context.channel.ID}`;
			const skipRepeat = await core.Cache.getByPrefix(key) as true | undefined;
			if (skipRepeat) {
				return;
			}

			await core.Cache.setByPrefix(key, true, { expiry: now + 10_000 });

			const siteLink = `https://supinic.com/data/suggestion/${ID}`;
			const githubLink = (data.link) ? `https:${data.link}` : "";

			await channel.send(`S#${ID}: ${siteLink} ${githubLink}`);
		})
	}
});
