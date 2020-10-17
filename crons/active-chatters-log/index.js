module.exports = {
	Name: "active-chatters-log",
	Expression: "0 */5 * * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function activeChattersLog () {
		if (!sb.Cache) {
			return;
		}
	
		const data = await sb.Cache.server.keys("active-chatter*");
		const row = await sb.Query.getRow("data", "Active_Chatter_Log");
	
		row.setValues({
			Amount: data.length,
			Timestamp: new sb.Date().discardTimeUnits("s", "ms")
		});
	
		await row.save();
	})
};