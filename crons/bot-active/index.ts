import type { CronDefinition } from "../index.js";

export default {
	name: "bot-active",
	expression: "0 */10 * * * *",
	description: "Pings the bot active API to make sure supibot is being registered as online",
	code: async function verifyBotActivity () {
		const platform = sb.Platform.get("twitch");
		if (!platform) {
			this.stop();
			return;
		}

		const userData = await sb.User.get(platform.selfName);
		if (!userData) {
			this.stop();
			return;
		}

		const authKey = await userData.getDataProperty("authKey");
		if (!authKey) {
			this.stop();
			return;
		}

		await core.Got.get("Supinic")({
			method: "PUT",
			url: "bot-program/bot/active",
			headers: {
				Authorization: `Basic ${userData.ID}:${authKey}`
			}
		});
	}
} satisfies CronDefinition;
