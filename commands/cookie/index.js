module.exports = {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Watch out - only one allowed per day, and no refunds! Daily reset occurs at midnight UTC.",
	Flags: ["mention","pipe","rollback"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cookie (context, check) {
		if (check === "check") {
			return {
				success: false,
				reply: `Use the check command instead!`
			};
		}
		else if (check === "gift" || check === "give") {
			return {
				success: false,
				reply: `Use the give command instead!`
			};
		}
	
		const data = await sb.Query.getRecordset(rs => rs
			.select("Cookie_Today")
			.from("chat_data", "Extra_User_Data")
			.where("User_Alias = %n", context.user.ID)
			.single()
		);
	
		if (data?.Cookie_Today) {
			const next = new sb.Date().addDays(1);
			const midnight = new sb.Date(sb.Date.UTC(next.year, next.getUTCMonth(), next.getUTCDate()));
	
			const delta = sb.Utils.timeDelta(midnight);
			return {
				reply: `You already opened or gifted a fortune cookie today. You can get another one at midnight UTC, which is ${delta}.`
			};
		}
	
		const [cookie] = await sb.Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Fortune_Cookie")
			.orderBy("RAND() DESC")
			.limit(1)
		);
	
		await context.transaction.query([
			"INSERT INTO chat_data.Extra_User_Data (User_Alias, Cookie_Today)",
			"VALUES (" + context.user.ID + ", 1)",
			"ON DUPLICATE KEY UPDATE Cookie_Today = 1"
		].join(" "));
	
		return { 
			reply: cookie.Text
		};
	}),
	Dynamic_Description: async (prefix) => {
		return [
			"Fetch a daily fortune cookie and read its wisdom!",
			"Only available once per day, and resets at midnight UTC.",
			"No arguments",
			"",
			prefix + "cookie => <Random wisdom!>"
		];
	}
};