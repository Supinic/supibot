module.exports = {
	Name: "subscribe",
	Aliases: ["unsubscribe"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Subscribe or unscribe to a database changing event. Check the extended help for detailed info on each subscription event.",
	Flags: ["mention","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: ({
		types: [
			{
				name: "Suggestion",
				aliases: ["suggest", "suggestion", "suggestions"],
				notes: "Whenever a suggestion you've made is updated, you will receive a private system reminder about it. Changes are detected every minute.",
				response: {
					added: "You will now receive private system reminders whenever a suggestion you made changes.",
					removed: "You will no longer receive suggestion reminders."
				}
			},
			{
				name: "Node.js updates",
				aliases: ["node", "nodejs", "node.js"],
				notes: "Every hour, supibot checks for new versions of Node.js. If a change is detected, you will be notified in #supinic.",
				response: {
					added: "You will now be pinged whenever a new version of Node.js is detected.",
					removed: "You will no longer receive pings when Node.js is updated."
				}
			},
			{
				name: "GGG tracker",
				aliases: ["ggg", "poe"],
				notes: "Every minute, supibot checks for new posts by GGG staff on their forums and Reddit. If you are subscribed, a new post like this will ping you in #supinic.",
				response: {
					added: "You will now be pinged whenever GGG staff posts.",
					removed: "You will no longer be pinged when GGG staff posts."
				}
			}
		]
	}),
	Code: (async function subscribe (context, type) {	
		if (!type) {
			return {
				success: false,
				reply: "No event provided! Check the command's extended help for a list."
			};
		}
	
		type = type.toLowerCase();
		const event = this.staticData.types.find(i => i.name === type || i.aliases.includes(type));
		if (!event) {
			return {
				success: false,
				reply: "Incorrect event provided! Check the extended command's help for a list."
			};
		}
	
		const { invocation } = context;
		const subscription = await sb.Query.getRecordset(rs => rs
			.select("ID", "Active")
			.from("chat_data", "Event_Subscription")
			.where("User_Alias = %n", context.user.ID)
			.where("Type = %s", event.name)
			.limit(1)
			.single()
		);
	
		const response = (invocation === "subscribe") ? event.response.added : event.response.removed;
		if (subscription) {
			if (
				(invocation === "subscribe" && subscription.Active)
				|| (invocation === "unsubscribe" && !subscription.Active)
			) {
				const preposition = (invocation === "subscribe") ? "to" : "from";
				return {
					success: false,
					reply: `You are already ${invocation}d ${preposition} this event!`
				};
			}
	
			await sb.Query.getRecordUpdater(rs => rs
				.update("chat_data", "Event_Subscription")
				.set("Active", !subscription.Active)
				.where("ID = %n", subscription.ID)
			);
	
			return {
				reply: `Sucessfully ${invocation}d. ${response}`
			};
		}
		else {
			if (invocation === "unsubscribe") {
				return {
					success: false,
					reply: `You are not subscribed to this event, so you cannot unsubscribe!`
				};
			}
	
			const row = await sb.Query.getRow("chat_data", "Event_Subscription");
			row.setValues({
				User_Alias: context.user.ID,
				Platform: context.platform.ID,
				Type: event.name,
				Active: true
			});
	
			await row.save();
			return {
				reply: `Sucessfully subscribed. ${response}`
			};
		}
	}),
	Dynamic_Description: async (prefix, values) => {
		const { types } = values.getStaticData();
		const typesList = types.map(i => sb.Utils.tag.trim `
			<li>
				<code>${i.name}</code>
				<br>Aliases: ${i.aliases.map(j => `<code>${j}</code>`).join(", ") || "(none)"}
				<br>${i.notes}			
			</li>
		`).join("");
	
		return [
			"Subscribes or unsubscribes your account from an event in Supibot's database.",
			"Depending on the event, you will be notified in different ways.",
			"",
	
			`<code>${prefix}subscribe (type)</code>`,
			"You will be subscribed to a given event.",
			"",
	
			`<code>${prefix}unsubscribe (type)</code>`,
			"You will be unsubscribed from a given event.",
			"",
	
			"List of available events:",
			`<ul>${typesList}</ul>`
		];
	}
};