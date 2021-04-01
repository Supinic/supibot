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
		else if (typeof redemption.reply !== "string") {
			console.warn("Redemption has no/invalid message configured", { channel: channel.ID });
			return;
		}

		await channel.send(redemption.reply);
	}),
	Author: "supinic"
};