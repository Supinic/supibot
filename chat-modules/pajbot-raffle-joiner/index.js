export default {
	Name: "pajbot-raffle-joiner",
	Events: ["message"],
	Description: "Conditionally joins points raffles initiated by Pajbot",
	Code: (async function pajbotRaffleJoiner (context) {
		if (context.user?.Name !== "pajbot") {
			return false;
		}

		const { message } = context;
		if (!message.includes("type") && !message.includes("!join") && !message.includes("will end")) {
			return false;
		}

		const points = Number(message.match(/(-?\d+)\s+points/)?.[1]);
		if (!points || points < 5000) {
			return;
		}

		const now = Date.now();
		this.data.timeout ??= 0;

		if (this.timeout > now) {
			return false;
		}
		else {
			this.timeout = now + 300_000;
		}

		const timeout = core.Utils.random(2_500, 20_000);
		const emote = await context.platform.getBestAvailableEmote(
			context.channel,
			["pajaS", "pajaW", "pajaH", "pajaScoots", "pajaL", "monkaS", "paaaajaW", "Okayga", "PAJAW", "paaaajaW"],
			":)"
		);

		setTimeout(() => context.channel.send("!join " + emote), timeout);
	}),
	Global: false,
	Platform: null
};
