module.exports = {
	Name: "link",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Verifies your account linking challenge across platforms. You should only ever use this command if you are prompted to.",
	Flags: ["mention","system"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function link (context, challengeString) {
		if (!context.privateMessage) {
			return {
				success: false,
				reply: `You cannot use this command outside of private messages!`
			};
		}
		else if (!challengeString) {
			return {
				success: false,
				reply: "If you have a challenge string, use it. If you don't have one, don't use this command."
			};
		}
	
		const challengeID = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_data", "User_Verification_Challenge")
			.where("User_Alias = %n", context.user.ID)
			.where("Platform_To = %n", context.platform.ID)
			.where("Challenge = %s", challengeString)
			.where("Status = %s", "Active")
			.limit(1)
			.single()
			.flat("ID")
		);
	
		if (typeof challengeID !== "number") {
			return {
				success: false,
				reply: `No active verification found!`
			};
		}
	
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		await row.load(challengeID);
	
		const sourcePlatform = sb.Platform.get(row.values.Platform_From);
		const targetPlatform = sb.Platform.get(row.values.Platform_To);
		
		const idColumnName = sourcePlatform.capital + "_ID";
		await context.user.saveProperty(idColumnName, row.values.Specific_ID);
		
		row.values.Status = "Completed";
		await row.save();
	
		return {
			reply: `Verification completed! You may now use the bot on ${sourcePlatform.capital} as well as ${targetPlatform.capital}.`
		};
	}),
	Dynamic_Description: null
};