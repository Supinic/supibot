module.exports = {
	Name: "stream-points-redemptions",
	Events: ["message"],
	Description: "Reacts to redemptions",
	Code: (async function streamPointsRedemption (context, ...args) {
		if (channel.mode === "Read") {
			return;
		}
		else if (args.length === 0) {
			return;
		}

		const { channel, data } = context;
		if (!data?.customRewardID) {
			return;
		}

		const redemption = args.find(i => i.redemption === data.customRewardID);
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