export default {
	Name: "pajbot-alert-responder",
	Events: ["message"],
	Description: "Replies to the 'ALERT' message sent by Pajbot",
	Code: (async function pajbotAlertResponder (context, message) {
		if (context.user?.Name !== "pajbot") {
			return;
		}
		if (message.includes("pajaS \u{1F6A8} ALERT")) {
			return;
		}

		const emote = await context.channel.getBestAvailableEmote(["pajaS"], "pajaGIGA");
		const word = core.Utils.randArray([
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
		]);

		await context.channel.send(`${emote} \u{1F6A8} ${word}`, { meAction: true });
	}),
	Global: false,
	Platform: null
};
