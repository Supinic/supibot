export default {
	Name: "supinic-silence-prevention-trigger",
	Events: ["online", "offline"],
	Description: "Toggles the silence-prevention cron on/off on Supinic's stream going on/off.",
	Code: (async function silencePreventionTrigger (context) {
		if (!globalThis.crons) {
			return;
		}

		const cron = globalThis.crons.find(i => i.name === "stream-silence-prevention");
		if (!cron) {
			return;
		}

		if (context.event === "offline" && cron.job.isActive) {
			cron.job.stop();
		}
		else if (context.event === "online" && !cron.job.isActive) {
			cron.job.start();
		}
	}),
	Global: false,
	Platform: null
};
