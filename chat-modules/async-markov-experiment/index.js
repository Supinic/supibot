module.exports = {
	Name: "async-markov-experiment",
	Events: ["message"],
	Description: "Super experimental automatic async markov tester thing",
	Code: (async function asyncMarkovExperiment (context) {
		if (this.data.skipped) {
			return;
		}
		else if (!this.data.markov) {
			try {
				const Markov = require("async-markov");
				this.data.markov = new Markov();
			}
			catch (e) {
				console.warn("async markov experiment failed", { error: e });
				this.data.skipped = true;
				return;
			}
		}

		const { message } = context;
		this.data.markov.add(message);
	}),
	Author: "supinic"
};