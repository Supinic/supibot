module.exports = {
	Name: "stream-points-redemptions",
	Events: ["message"],
	Description: "Reacts to redemptions",
	Code: (async function streamPointsRedemption (context, ...args) {
		if (args.length === 0) {
			return;
		}

		const { channel, messageData } = context;
		if (!messageData?.customRewardID) {
			return;
		}

		const redemption = args.find(i => i.redemption === messageData.customRewardID);
		if (!redemption) {
			return;
		}

		await channel.send(redemption.message);
	}),
	Author: "supinic"
};