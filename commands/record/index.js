module.exports = {
	Name: "record",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Checks for various max/min records of various sources.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function record (context, type, target) {
		if (!type) {
			return {
				reply: "No type provided!"
			};
		}
	
		type = type.toLowerCase();
		target = target || context.user;
		const userData = await sb.User.get(target);
	
		switch (type) {
			case "afk":
				if (userData.ID !== context.user.ID) {
					return {
						reply: "Cannot be checked on people other than you!"
					};
				}
	
				const data = await sb.Query.getRecordset(rs => rs
					.select("Ended")
					.select("(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) AS Seconds")
					.from("chat_data", "AFK")
					.where("User_Alias = %n", userData.ID)
					.where("Ended IS NOT NULL")
					.orderBy("Seconds DESC")
					.limit(1)
					.single()
				);
	
				if (!data) {
					return {
						reply: "No AFK status found!"
					};
				}
	
				const formatted = sb.Utils.formatTime(sb.Utils.round(data.Seconds, 0), false);
				const delta = sb.Utils.timeDelta(data.Ended);
				return {
					reply: `Your longest AFK period lasted for ${formatted} - this was ${delta}.`
				};
	
			case "cookie": {
				const { Cookies_Total: cookies, User_Alias: user } = await sb.Query.getRecordset(rs => rs
					.select("Cookies_Total", "User_Alias")
					.from("chat_data", "Extra_User_Data")
					.orderBy("Cookies_Total DESC")
					.limit(1)
					.single()
				);
				
				const userData = await sb.User.get(user, true);			
				return {
					reply: `Currently, the most consistent cookie consumer is ${userData.Name} with ${cookies} daily cookies eaten` 
				};
			}
	
			default: return { reply: "Invalid type provided!" };
		};
	}),
	Dynamic_Description: null
};