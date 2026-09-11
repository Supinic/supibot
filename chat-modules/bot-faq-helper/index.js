export default {
	name: "bot-faq-helper",
	description: "Attempts to auto-reply to various queries related to the bot",
	platforms: "all",
	scopes: ["channel", "platform"],
	handlers: {
		message: async function (context) {
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
		}
	}
};
