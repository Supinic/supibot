module.exports = {
	Name: "suggest",
	Aliases: ["suggestions"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Suggest something for Supinic. When you post your first suggestion, you will automatically receive reminders when your suggestions get updated. Posts links to a suggestion list if you don't provide any text. To remove, check the $unset command.",
	Flags: ["mention","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function suggest (context, ...args) {
		if (args.length === 0 || context.invocation === "suggestions") {
			return {
				reply: sb.Utils.tag.trim `
					No suggestion text provided!
					Your suggestions here: https://supinic.com/data/suggestion/list?userName=${context.user.Name}
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
			.from("data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", "Suggestion")
			.flat("ID")
			.single()
		);
	
		let subscribed = "";
		if (!isSubscribed) {
			const row = await sb.Query.getRow("data", "Event_Subscription");
			row.setValues({
				Active: true,
				Platform: context.platform.ID,
				Type: "Suggestion",
				User_Alias: context.user.ID
			});
	
			await row.save();
			subscribed = "You will now receive reminders when your suggestions get updated - you can use the $unsubscribe command to remove this. ";
		}
	
		const link = `https://supinic.com/data/suggestion/${row.values.ID}`;
		const emote = (context.platform.Name === "twitch")
			? "BroBalt"
			: "👍";
	
		return {
			reply: `Suggestion saved, and will eventually be processed (ID ${row.values.ID}) ${link} ${emote} ${subscribed}`
		};
	}),
	Dynamic_Description: null
};
