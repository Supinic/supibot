module.exports = {
	Name: "stream-points-redemptions",
	Events: ["message"],
	Description: "Reacts to redemptions",
	Code: (async function streamPointsRedemption (context) {
		if (this.data.config === null) {
			return;
		}
		else if (typeof this.data.config === "undefined") {
			try {
				this.data.config = require("./config.js");
			}
			catch (e) {
				console.warn("redemption chat module fail", e);
				this.data.config = null;
				return;
			}
		}

		const { messageData } = context;
		if (!messageData?.customRewardID) {
			return;
		}

		const redemption = this.data.config.find(i => i.redemption === messageData.customRewardID);
		if (!redemption) {
			return;
		}

		await redemption.callback(context);
	}),
	Author: "supinic"
};