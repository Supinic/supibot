module.exports = {
	Name: "charity-cookie",
	Expression: "0 55 1 * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function giveOutCharityCookie () {
		const excludedUsers = [2630, 35532, 2756, 1127];
		
		const data = await sb.Query.getRecordset(rs => rs
			.select("Extra_User_Data.User_Alias", "Channel")
			.from("chat_data", "Extra_User_Data")
			.join({
				toDatabase: "chat_data",
				toTable: "Message_Meta_User_Alias",
				on: "Message_Meta_User_Alias.User_Alias = Extra_User_Data.User_Alias"
			})
			.join({
				toDatabase: "chat_data",
				toTable: "Channel",
				on: "Message_Meta_User_Alias.Channel = Channel.ID"
			})
			.where("Channel.Mode <> %s", "Read")
			.where("Extra_User_Data.User_Alias NOT IN %n+", excludedUsers)
			.where("Cookie_Today = %b", false)
			.where("Last_Message_Posted >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)")
			.orderBy("RAND()")
			.limit(1)
			.single()
		);
	
		const transaction = await sb.Query.getTransaction();
		const userData = await sb.User.get(data.User_Alias);
		const channelData = sb.Channel.get(data.Channel);
		const cookie = await sb.Command.get("cookie").execute({ user: userData, transaction }, "automatic cookie by supibot");
	
		await transaction.commit();
	
		await channelData.send(`Congratulations ${userData.Name}, you have won an automatic cookie! ${cookie.reply}`);
	})
};