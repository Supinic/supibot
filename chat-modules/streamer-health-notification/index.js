module.exports = {
	Name: "streamer-health-notification",
	Events: ["online", "offline"],
	Description: "Sets up a periodic \"health notification\" when the channel goes live, and removes it when going offline.",
	Code: (async function streamerHealthPrevention (context, options = {}) {
		const { channel, event } = context;
		if (channel.mode === "Read") {
			return;
		}
		else if (typeof this.data.intervals === "undefined") {
			this.data.intervals = {};
		}

		const { minuteDelay = 30 } = options;
		const { intervals } = this.data;
		if (event === "online" && !intervals[channel.ID]) {
			intervals[channel.ID] = setInterval(
				() => channel.send("Make sure to stay hydrated 💧 and stretch 💪 regularly!"),
				minuteDelay * 60_000
			);
		}
		else if (event === "offline" && intervals[channel.ID]) {
			clearInterval(intervals[channel.ID]);
			intervals[channel.ID] = null;
		}
	}),
	Author: "supinic"
};
