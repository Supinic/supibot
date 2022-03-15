module.exports = {
	Name: "active-chatters-log",
	Expression: "0 */5 * * * *",
	Description: "Logs the amount of currently active chatters.",
	Defer: null,
	Type: "Bot",
	Code: (async function activeChattersLog () {
		if (!sb.Query || !sb.User) {
			return;
		}

		const row = await sb.Query.getRow("data", "Active_Chatter_Log");
		row.setValues({
			Amount: sb.User.data.size,
			Timestamp: new sb.Date().discardTimeUnits("s", "ms")
		});

		await row.save();
	})
};
