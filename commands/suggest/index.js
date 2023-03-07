module.exports = {
	Name: "suggest",
	Aliases: ["suggestions"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Suggest something for Supinic. When you post your first suggestion, you will automatically receive reminders when your suggestions get updated. Posts links to a suggestion list if you don't provide any text. To remove, check the $unset command.",
	Flags: ["mention","skip-banphrase"],
	Params: [
		{ name: "amend", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function suggest (context, ...args) {
		if (args.length === 0 || context.invocation === "suggestions") {
			return {
				reply: sb.Utils.tag.trim `
					No suggestion text provided!
					Your suggestions here: https://supinic.com/data/suggestion/list?columnAuthor=${context.user.Name}
				`,
				cooldown: 5000
			};
		}

		const text = args.join(" ");
		const row = await sb.Query.getRow("data", "Suggestion");
		if (context.params.amend) {
			await row.load(context.params.amend, true);
			if (!row.loaded) {
				return {
					success: false,
					reply: "There is no suggestion with that ID!"
				};
			}
			else if (row.values.User_Alias !== context.user.ID) {
				return {
					success: false,
					reply: "That suggestion was not made by you!"
				};
			}

			row.setValues({
				Text: `${row.values.Text}\n\n--- Amended on ${new sb.Date()}: ---\n${text}`
			});

			await row.save({ skipLoad: true });

			return {
				reply: `Your suggestion ID ${row.values.ID} was succesfully amended.`
			};
		}
		else {
			row.setValues({
				Text: text,
				User_Alias: context.user.ID,
				Priority: 255
			});

			await row.save({ skipLoad: true });
		}

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
