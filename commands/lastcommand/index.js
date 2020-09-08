module.exports = {
	Name: "lastcommand",
	Aliases: ["_"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Posts your last command executed in the current channel. Only goes back up to 1 minute.",
	Flags: ["pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function lastCommand (context) {
		const data = await sb.Query.getRecordset(rs => {
			rs.select("Result")
				.from("chat_data", "Command_Execution")
				.where("Command <> %n", this.ID)
				.where("User_Alias = %n", context.user.ID)
				.where("Executed > DATE_ADD(NOW(), INTERVAL -1 MINUTE)")
				.where("Result IS NOT NULL")
				.orderBy("Executed DESC")
				.limit(1)
				.single();
	
			if (context.channel) {
				rs.where("Channel = %n", context.channel.ID)
			}
			else {
				rs.where("Channel IS NULL").where("Platform = %n", context.platform.ID);
			}
	
			return rs;
		});
	
		return {
			reply: (data?.Result)
				? String(data.Result)
				: "No recent command execution found!"
		};
	}),
	Dynamic_Description: null
};