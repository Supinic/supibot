module.exports = {
	Name: "async-markov-experiment",
	Events: ["message"],
	Description: "Super experimental automatic async markov tester thing",
	Code: (async function asyncMarkovExperiment (context) {
		if (this.data.skipped) {
			return;
		}
		else if (!context.channel) {
			return;
		}

		if (!this.data.markovs) {
			this.data.markovs = new Map();
		}
		if (!this.data.markovs.has(context.channel.ID)) {
			try {
				const Markov = require("async-markov");
				this.data.markovs.set(context.channel.ID, new Markov());
			}
			catch (e) {
				console.warn("async markov experiment failed", { error: e });
				this.data.skipped = true;
				return;
			}
		}
		if (!this.data.regex) {
			// only allows messages consisting of just emojis, or ASCII 32-126 characters (0x20-0x7E)
			this.data.regex = /^[\p{Emoji}\x20-\x7e]+$/ui;
		}
		if (typeof this.data.threshold !== "number") {
			this.data.threshold = 25_000;
		}

		const markov = this.data.markovs.get(context.channel.ID);
		if (markov.size > this.data.threshold) {
			return;
		}

		const { message, user } = context;
		if (message.includes("http:") || message.includes("https:")) {
			return;
		}
		else if (!user || user.Name.includes("bot") || sb.User.bots.has(user.ID)) {
			return;
		}

		const fixedMessage = message.replace(/\u{E0000}/gu, "");
		if (!this.data.regex.test(fixedMessage)) {
			return;
		}

		markov.add(fixedMessage);
	}),
	Author: "supinic"
};