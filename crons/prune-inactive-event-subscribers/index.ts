import type { CronDefinition } from "../index.js";

type SubscriptionRow = {
	ID: number;
	User_Alias: number;
	Active: boolean;
};
type SubTableData = Omit<SubscriptionRow, "Active">;
type SubData = {
	subscription: SubscriptionRow["ID"];
	user: SubscriptionRow["User_Alias"];
};

const deactivate = async (sub: SubTableData): Promise<SubData> => {
	const row = await core.Query.getRow<SubscriptionRow>("data", "Event_Subscription");
	await row.load(sub.ID);

	row.values.Active = false;
	await row.save({ skipLoad: true });

	return {
		user: sub.User_Alias,
		subscription: sub.ID
	};
};

export default {
	name: "prune-inactive-event-subscribers",
	expression: "0 0 0 * * *",
	description: "Removes bot event subscribers if they become inactive.",
	code: (async function pruneInactiveEventSubscribers () {
		const twitch = sb.Platform.get("twitch");
		if (!twitch) {
			this.stop();
			return;
		}

		const subscriptions = await core.Query.getRecordset<SubTableData[]>(rs => rs
			.select("ID", "User_Alias")
			.from("data", "Event_Subscription")
			.where("Type NOT IN %s+", ["Suggestion", "Channel live"])
			.where("Active = %b", true)
			// this should technically check other platforms but is so infrequent it's probably not worth it
			.where("Platform = %n", twitch.ID)
		);

		const result: SubData[] = [];
		const checkedUsers = new Map<SubscriptionRow["User_Alias"], "deactivate" | "skip">();
		for (const sub of subscriptions) {
			const status = checkedUsers.get(sub.User_Alias);
			if (status === "skip") {
				continue;
			}
			else if (status === "deactivate") {
				result.push(await deactivate(sub));
				continue;
			}

			const userData = await sb.User.getAsserted(sub.User_Alias);
			const userId = await twitch.getUserID(userData.Name);
			if (!userId) {
				result.push(await deactivate(sub));
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
} satisfies CronDefinition;
