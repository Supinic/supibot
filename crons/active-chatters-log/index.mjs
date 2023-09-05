export const definition = {
	name: "active-chatters-log",
	expression: "0 */5 * * * *",
	description: "Logs the amount of currently active chatters.",
	code: (async function activeChattersLog () {
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("data", "Active_Chatter_Log");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		if (!sb.User) {
			return;
		}

		const row = await sb.Query.getRow("data", "Active_Chatter_Log");
		row.setValues({
			Amount: sb.User.data.size,
			Timestamp: new sb.Date().discardTimeUnits("s", "ms")
		});

		await row.save({ skipLoad: true });
	})
};
