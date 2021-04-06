module.exports = {
	Name: "bot-active",
	Expression: "0 */10 * * * *",
	Description: "Pings the bot active API to make sure supibot is being registered as online",
	Defer: null,
	Type: "Bot",
	Code: (async function verifyBotAcitivity () {
		const platform = sb.Platform.get(1);
		const userData = await sb.User.get(platform.Self_Name);
		if (!userData || !userData.Data.authKey) {
			console.warn("Bot-activity refresh cron is missing bot data or auth key");
			this.stop();
			return;
		}

		await sb.Got("Supinic", {
			method: "PUT",
			url: "bot-program/bot/active",
			headers: {
				Authorization: `Basic ${userData.ID}:${userData.Data.authKey}`,
			}
		});
	})
};