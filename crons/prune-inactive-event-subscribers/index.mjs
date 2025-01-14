const deactivate = async (sub, resultArray) => {
	const row = await sb.Query.getRow("data", "Event_Subscription");
	await row.load(sub.ID);

	row.values.Active = false;
	await row.save({ skipLoad: true });

	resultArray.push({
		user: sub.User_Alias,
		subscription: sub.ID
	});
};

export const definition = {
	name: "prune-inactive-event-subscribers",
	expression: "0 0 0 * * *",
	description: "Removes bot event subscribers if they become inactive.",
	code: (async function pruneInactiveEventSubscribers () {
		const twitch = sb.Platform.get("twitch");
		const subscriptions = await sb.Query.getRecordset(rs => rs
			.select("ID", "User_Alias")
			.from("data", "Event_Subscription")
			.where("Type NOT IN %s+", ["Suggestion", "Channel live"])
			.where("Active = %b", true)
			// this should technically check other platforms but is so infrequent it's probably not worth it
			.where("Platform = %n", twitch.ID)
		);

		const result = [];
		const checkedUsers = new Map();
		for (const sub of subscriptions) {
			const status = checkedUsers.get(sub.User_Alias);
			if (status === "skip") {
				continue;
			}
			else if (status === "deactivate") {
				await deactivate(sub, result);
				continue;
			}

			const userData = await sb.User.get(sub.User_Alias);
			const userId = await twitch.getUserID(userData.Name);
			if (!userId) {
				await deactivate(sub, result);
				checkedUsers.set(sub.User_Alias, "deactivate");
			}
			else {
				checkedUsers.set(sub.User_Alias, "skip");
			}
		}

		await sb.Logger.log("System.Success", JSON.stringify({
			deactivated: result
		}));
	})
};
