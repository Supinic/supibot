module.exports = {
	Name: "supinic-silence-prevention-trigger",
	Events: ["online", "offline"],
	Description: "Toggles the silence-prevention cron on/off on Supinic's stream going on/off.",
	Code: (async function silencePreventionTrigger (context) {
		const cron = sb.Cron.get("stream-silence-prevention");
		if (!cron) {
			return;
		}

		if (context.event === "offline" && cron.started) {
			cron.stop();
		}
		else if (context.event === "online" && !cron.started) {
			cron.start();
		}
	}),
	Global: false,
	Platform: null
};
