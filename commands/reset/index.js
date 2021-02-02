module.exports = {
	Name: "reset",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Tracks your last \"\"\"reset\"\"\".",
	Flags: ["mention","pipe","system"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function reset (context, ...args) { 
		const message = args.join(" ") || null;
		const existing = await sb.Query.getRecordset(rs => rs
			.select("Timestamp")
			.from("data", "Reset")
			.where("User_Alias = %n", context.user.ID)
			.orderBy("ID DESC")
			.limit(1)
			.single()
		);
	
		const row = await sb.Query.getRow("data", "Reset");
		row.setValues({
			User_Alias: context.user.ID,
			Reason: message
		});
	
		await row.save();
	
		if (existing) {
			const delta = sb.Utils.timeDelta(existing.Timestamp);
			return {
				reply: "Successfully noted. Your last reset was " + delta
			};
		}
		else {
			return {
				reply: "Successfully noted. This your first reset."
			};
		}
	}),
	Dynamic_Description: null
};