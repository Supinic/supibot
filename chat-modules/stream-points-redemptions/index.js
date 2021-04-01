module.exports = {
	Name: "stream-points-redemptions",
	Events: ["message"],
	Description: "Reacts to redemptions",
	Code: (async function streamPointsRedemption (context) {
		if (this.data.config === null) {
			return;
		}
		else if (typeof this.data.config === "undefined") {
			this.data.config = [
				{
					name: "Javascript rant",
					redemption: "44df442f-3fe8-4417-a377-112ff9c3708a",
					channel: 38,
					callback: (context) => {
						context.channel.send("@Supinic, time to rant about JS FeelsJavascriptMan");
					}
				}
			];
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