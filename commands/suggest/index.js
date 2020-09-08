module.exports = {
	Name: "suggest",
	Aliases: ["suggestions"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 60000,
	Description: "Suggest a feature for Supinic, regarding Supibot, Discord/Cytube, or the website. Posts links to a suggestion list if you don't provide any text.",
	Flags: ["mention","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function suggest (context, ...args) {
		if (args.length === 0 || context.invcation === "suggestions") {
			return {
				reply: sb.Utils.tag.trim `
					No suggestion text provided!
					Your suggestions here: https://supinic.com/data/suggestion/list?columnAuthor=${context.user.Name}
				`,
				cooldown: 5000
			};
		}
	
		const row = await sb.Query.getRow("data", "Suggestion");
		row.setValues({
			Text: args.join(" "),
			User_Alias: context.user.ID,
			Priority: 255
		});
	
		await row.save();
	
		const isSubscribed = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", "Suggestion")
			.flat("ID")
			.single()
		);
	
		let subscribed = "";
		if (!isSubscribed) {
			const row = await sb.Query.getRow("chat_data", "Event_Subscription");
			row.setValues({
				Active: true,
				Platform: context.platform.ID,
				Type: "Suggestion",
				User_Alias: context.user.ID
			});
	
			await row.save();
			subscribed = "You will now receive reminders when your suggestions get updated - you can use the $unsubscribe command to remove this. "
		}
	
		const emote = (context.platform.Name === "twitch")
			? "BroBalt"
			: "👍";
	
		return {
			reply: `Suggestion saved, and will eventually be processed (ID ${row.values.ID}) ${emote} ${subscribed}`
		};
	}),
	Dynamic_Description: null
};