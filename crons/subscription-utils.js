const fetchSubscriptionUsers = async function (subType, lastSeenThreshold = 36e5) {
	const users = await sb.Query.getRecordset(rs => rs
		.select("Event_Subscription.User_Alias AS ID")
		.select("User_Alias.Name AS Username")
		.select("MAX(Meta.Last_Message_Posted) AS Last_Seen")
		.from("data", "Event_Subscription")
		.join("chat_data", "User_Alias")
		.join({
			toDatabase: "chat_data",
			toTable: "Message_Meta_User_Alias",
			alias: "Meta",
			on: "Event_Subscription.User_Alias = Meta.User_Alias"
		})
		.groupBy("Meta.User_Alias")
		.where("Type = %s", subType)
		.where("Active = %b", true)
	);

	const now = sb.Date.now();
	const [activeUsers, inactiveUsers] = sb.Utils.splitByCondition(users, i => now - i.Last_Seen < lastSeenThreshold);

	return {
		activeUsers,
		inactiveUsers
	};
};

const createReminders = async function (users, message) {
	return await Promise.all(users.map(user => (
		sb.Reminder.create({
			Channel: null,
			User_From: 1127,
			User_To: user.ID,
			Text: `${message} (you were not around when it was announced)`,
			Schedule: null,
			Created: new sb.Date(),
			Private_Message: true,
			Platform: 1
		}, true)
	)));
};

const handleSubscription = async function (subType, message, options = {}) {
	const { activeUsers, inactiveUsers } = await fetchSubscriptionUsers(subType);

	await createReminders(inactiveUsers, message);

	const chatPing = activeUsers.map(i => `@${i.Username}`).join(" ");
	const targetChannel = sb.Channel.get(options.targetChannel ?? 38);
	await targetChannel.send(`${chatPing} ${message}`);
};

module.exports = {
	handleSubscription
};
