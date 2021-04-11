module.exports = {
	Name: "offline-only-mirror",
	Events: ["online", "offline"],
	Description: "This module manages channel mirrors so that they are only in effect when the channel is offline.",
	Code: (async function offlineOnlyMirror (context) {
		if (typeof this.data.mirrors === "undefined") {
			this.data.mirrors = new Map();
		}
		
		const { event, channel } = context;
		if (event === "online" && channel.Mirror !== null) {
			this.data.mirrors.set(channel, channel.Mirror);
			channel.Mirror = null;
		}
		else if (event === "offline" && this.data.mirrors.has(channel)) {
			channel.Mirror = this.data.mirrors.get(channel);
			this.data.mirrors.delete(channel);
		}
		else {
			console.warn("Invalid combination of channel, event and mirror status", {
				channel: channel.ID,
				event,
				mirror: channel.Mirror
			});
		}
	}),
	Author: "supinic"
};