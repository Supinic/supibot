module.exports = {
	Name: "atop",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Fetches the top 10 users by total amount of chat lines across all channels. This is a very heavy operation on SQL, so please use it sparingly.",
	Flags: ["mention","pipe","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function atop () {
		const top = await sb.Query.getRecordset(rs => rs
			.select("User_Alias", "SUM(Message_Count) AS Total")
			.from("chat_data", "Message_Meta_User_Alias")
			.groupBy("User_Alias")
			.orderBy("SUM(Message_Count) DESC")
			.limit(10)
		);
	
		const users = await sb.User.getMultiple(top.map(i => i.User_Alias));
		const string = top.map((stats, index) => {
			const user = users.find(i => stats.User_Alias === i.ID);
			return `#${index + 1}: ${user.Name} (${sb.Utils.groupDigits(stats.Total)})`;
		}).join("; ");
	
		return { 
			reply: "Top users by total chat lines across all channels: " + string
		};
	}),
	Dynamic_Description: null
};