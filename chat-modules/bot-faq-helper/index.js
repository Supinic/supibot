export default {
	Name: "bot-faq-helper",
	Events: ["message"],
	Description: "Attempts to auto-reply to various queries related to the bot",
	Code: (async function botFaqHelper (context) {
		if (!context.user?.Name) {
			return;
		}

		const { message } = context;
		if (message.startsWith("$")) {
			return;
		}

		const lower = message.toLowerCase();
		if ((!lower.includes("how can i") && !lower.includes("how do i")) || !lower.includes("supibot")) {
			return;
		}

		const now = Date.now();
		this.data.timeout ??= 0;

		if (this.data.timeout > now) {
			return;
		}
		else {
			this.data.timeout = now + 60_000;
		}

		const user = context.user.Name;
		await context.channel.send(`@${user}, you should check the FAQ first: https://supinic.com/data/faq/list :)`);
	}),
	Global: false,
	Platform: null
};
