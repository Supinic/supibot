module.exports = {
	Name: "totalcountline",
	Aliases: ["acl","tcl"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the total amount of a user's (or yours, if nobody was specified) chat lines in all tracked channels summed together.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function totalCountLines (context, target) {
		if (!target) {
			target = context.user;
		}
	
		const userData = await sb.User.get(target);
		if (!userData)  {
			return { 
				reply: `That user was not found in the database!`
			};
		}	
	
		const data = (await sb.Query.getRecordset(rs => rs
			.select("SUM(Message_Count) AS Total")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.single()
		));
		
		if (data.Total === null) {
			return { 
				reply: `That user is being tracked, but they have not said any lines in the channels I watch.`
			};
		}
	
		const who = (context.user.ID === userData.ID) ? "You have" : "That user has";
		return { 
			reply: `${who} sent ${sb.Utils.groupDigits(data.Total)} chat lines across all tracked channels so far.`
		};
	}),
	Dynamic_Description: null
};