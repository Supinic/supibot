import unsetSuggestionSubcommand from "../set/subcommands/suggestion.js";

export default {
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
	Code: (async function suggest (context, ...args) {
		if (args.length === 0 || context.invocation === "suggestions") {
			return {
				reply: core.Utils.tag.trim `
					No suggestion text provided!
					Your suggestions here: https://supinic.com/data/suggestion/list?columnAuthor=${context.user.Name}
				`,
				cooldown: 5000
			};
		}

		const text = args.join(" ");
		const row = await core.Query.getRow("data", "Suggestion");
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

			const date = new sb.Date().format("Y-m-d H:i:s");
			row.setValues({
				Text: `${row.values.Text}\n\n--- Amended on ${date} ---\n${text}`
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

		const isSubscribed = await core.Query.getRecordset(rs => rs
			.select("ID")
			.from("data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", "Suggestion")
			.flat("ID")
			.single()
		);

		let subscribed = "";
		if (!isSubscribed) {
			const row = await core.Query.getRow("data", "Event_Subscription");
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
	Dynamic_Description: () => [
		"Creates a new suggestion for Supinic to take a look at in the near future.",
		"These should avoid jokes, memes and such - focus instead on proper issues, bug reports, questions, ideas etc.",
		"",

		`You can remove a suggestion you've created via the <code><a href="/bot/command/detail/unset">$unset suggestion (ID)</a></code> command.`,
		"For more info, check that command's help page.",
		"",

		`<code>$suggest (text)</code>`,
		"Creates a suggestion.",
		"You will provided with a tracking ID with which you can check the suggestion's progress",
		"The first usage will subscribe you, so you will get a reminder from Supibot when the suggestion's status changes.",
		"",

		`<code>$suggest amend:(ID) (text)</code>`,
		"Amends an existing suggestion that you've made with more text.",
		"",

		`<code>$unset ${unsetSuggestionSubcommand.name} (${unsetSuggestionSubcommand.parameter})</code>`,
		unsetSuggestionSubcommand.description
	]
};
