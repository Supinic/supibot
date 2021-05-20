module.exports = {
	Name: "pyramid-detection",
	Events: ["message"],
	Description: "Detects \"pyramids\" in chat. Congratulates the persons who finishes one and demeans the persons who break one.",
	Code: (async function pyramidDetection (context, options = {}) {
		const { channel, message, user } = context;
		const { threshold = 3 } = options;

		if (!channel) {
			return;
		}
		else if (channel.mode === "Read") {
			return;
		}
		else if (!user || user.Name === channel.Platform.Self_Name) {
			return;
		}
	
		if (!this.data.pyramids) {
			this.data.pyramids = {};
		}
	
		const normalMessage = message.trim().replace(/\s+/g, " ") + " ";
		if (!this.data.pyramids[channel.ID]) {
			this.data.pyramids[channel.ID] = {
				base: normalMessage,
				maxLevel: 1,
				level: 1,
				ascending: true
			};
		}
	
		const pyramid = this.data.pyramids[channel.ID];
		const previousLevel = pyramid.level;
	
		if (pyramid.ascending && pyramid.base.repeat(pyramid.level + 1) === normalMessage) {
			pyramid.maxLevel++;
			pyramid.level++;
		}
		else if (pyramid.base.repeat(pyramid.level - 1) === normalMessage) {
			pyramid.ascending = false;
			pyramid.level--;
		}
	
		if (previousLevel !== pyramid.level && !pyramid.ascending && pyramid.level === 1) {
			if (pyramid.maxLevel >= threshold) {
				await channel.send(`${user.Name} finished a ${pyramid.maxLevel} tall pyramid Kappa Clap`);
			}
	
			pyramid.maxLevel = 1;
			pyramid.ascending = true;
			pyramid.level = 1;
			pyramid.base = normalMessage;
		}
		else if (previousLevel === pyramid.level) {
			if (pyramid.maxLevel >= threshold) {
				await channel.send(`${user.Name} ruined a ${pyramid.maxLevel} tall pyramid PepeLaugh Clap`);
			}
	
			pyramid.maxLevel = 1;
			pyramid.ascending = true;
			pyramid.level = 1;
			pyramid.base = normalMessage;
		}
	}),
	Author: "supinic"
};