module.exports = {
	Name: "stream-points-redemptions",
	Events: ["message"],
	Description: "Reacts to redemptions",
	Code: (async function streamPointsRedemption (context, ...args) {
		const { channel, data } = context;
		if (channel.mode === "Read") {
			return;
		}
		else if (args.length === 0) {
			return;
		}
		else if (!data || !data.customRewardID) {
			return;
		}

		const redemption = args.find(i => i.redemption === data.customRewardID);
		if (!redemption) {
			return;
		}

		if (typeof redemption.reply === "string") {
			await channel.send(redemption.reply);
		}
		else if (typeof redemption.callback === "function") {
			const result = await redemption.callback(context, redemption);
			if (result) {
				await channel.send(result);
			}
		}
		else {
			console.warn("Redemption has no/invalid message configured", { channel: channel.ID });
		}
	}),
	Global: false,
	Platform: null
};
