export const definition = {
	name: "bot-active",
	expression: "0 */10 * * * *",
	description: "Pings the bot active API to make sure supibot is being registered as online",
	code: (async function verifyBotAcitivity () {
		if (!sb.Platform || !sb.User) {
			return;
		}

		const platform = sb.Platform.get(1);
		const userData = await sb.User.get(platform.Self_Name);
		if (!userData) {
			console.warn("Bot-activity refresh cron is missing bot's user data");
			this.stop();
			return;
		}

		const authKey = await userData.getDataProperty("authKey");
		if (!authKey) {
			console.warn("Bot-activity refresh cron is missing bot's auth key");
			this.stop();
			return;
		}

		await sb.Got("Supinic", {
			method: "PUT",
			url: "bot-program/bot/active",
			headers: {
				Authorization: `Basic ${userData.ID}:${authKey}`
			}
		});
	})
};
