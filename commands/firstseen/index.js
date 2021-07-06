module.exports = {
	Name: "firstseen",
	Aliases: ["fs"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given user, this command tells you when they were first seen, based on Supibot's chat logs.",
	Flags: ["block","mention","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstSeen (context, user) {
		const userData = (user) ? await sb.User.get(user) : context.user;
		if (!userData) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		const missingFirstLineChannels = await sb.Query.getRecordset(rs => rs
			.select("Channel")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.where("First_Message_Posted IS NULL")
			.flat("Channel")
		);

		if (missingFirstLineChannels.length > 0) {
			const promises = [];
			for (const channelID of missingFirstLineChannels) {
				const channelData = sb.Channel.get(channelID);
				if (!channelData) {
					continue;
				}

				const promise = (async () => {
					const message = await sb.Query.getRecordset(rs => rs
						.select("Text", "Posted")
						.from("chat_line", channelData.getDatabaseName())
						.where("User_Alias = %n", userData.ID)
						.orderBy("ID ASC")
						.limit(1)
						.single()
					);

					if (!message) {
						return;
					}

					const row = await sb.Query.getRow("chat_data", "Message_Meta_User_Alias");
					await row.load({
						User_Alias: userData.ID,
						Channel: channelData.ID
					}, true);

					if (!row.loaded) {
						return;
					}

					row.setValues({
						First_Message_Text: message.Text,
						First_Message_Posted: message.Posted
					});

					await row.save({ skipLoad: true });
				})();

				promises.push(promise);
			}

			await Promise.all(promises);
		}

		const data = await sb.Query.getRecordset(rs => rs
			.select("Channel", "First_Message_Posted AS Date", "First_Message_Text AS Message")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.where("First_Message_Posted IS NOT NULL")
			.orderBy("First_Message_Posted ASC")
			.limit(1)
			.single()
		);

		if (!data) {
			return {
				reply: sb.Utils.tag.trim `
					That user is in the database, but never showed up in chat.
					They were first spotted ${sb.Utils.timeDelta(userData.Started_Using)}.
				`
			};
		}

		const channelData = sb.Channel.get(data.Channel);
		const who = (userData === context.user) ? "You were" : "That user was";
		const belongsTo = (userData === context.user) ? "your" : "their";

		return {
			reply: sb.Utils.tag.trim `
				${who}
				first seen in chat ${sb.Utils.timeDelta(data.Date)},
				(channel ${channelData.Description ?? channelData.Name})
				${belongsTo} message: ${data.Message}
			`
		};
	}),
	Dynamic_Description: null
};
