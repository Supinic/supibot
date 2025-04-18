let isTableAvailable;
let latestID;

export default {
	name: "changelog-announcer",
	expression: "0 */30 * * * *",
	description: "Watches for new changelogs, and if found, posts them to the specified channel(s).",
	code: (async function changelogAnnouncer (cron) {
		isTableAvailable ??= await core.Query.isTablePresent("data", "Event_Subscription");
		if (isTableAvailable === false) {
			cron.job.stop();
			return;
		}

		if (typeof latestID !== "number") {
			latestID = await core.Query.getRecordset(rs => rs
				.select("MAX(ID) AS Max")
				.from("data", "Changelog")
				.single()
				.flat("Max")
			);

			return;
		}

		const data = await core.Query.getRecordset(rs => rs
			.select("ID", "Created", "Title", "Type", "Description")
			.from("data", "Changelog")
			.where("ID > %n", latestID)
		);

		if (data.length === 0) {
			return;
		}

		latestID = Math.max(...data.map(i => i.ID));

		const subscriptions = await core.Query.getRecordset(rs => rs
			.select("User_Alias", "Platform", "Flags")
			.from("data", "Event_Subscription")
			.where("Type = %s", "Changelog")
			.where("Active = %b", true)
		);

		if (subscriptions.length > 0) {
			let message;
			if (data.length === 1) {
				const link = `https://supinic.com/data/changelog/detail/${data[0].ID}`;
				message = `New changelog entry detected! ${data[0].Type}: ${data[0].Title} Detail: ${link}`;
			}
			else {
				const params = data.map(i => `ID=${i.ID}`).join("&");
				const relay = await core.Got.get("Supinic")({
					method: "POST",
					url: "relay",
					throwHttpErrors: false,
					json: {
						url: `/data/changelog/lookup?${params}`
					}
				});

				let link;
				if (relay.statusCode === 200) {
					link = relay.body.data.link;
				}
				else {
					link = `Multiple IDs: ${data.map(i => i.ID).join(", ")}`;
				}

				message = `New changelog entries detected! Details: ${link}`;
			}

			for (const sub of subscriptions) {
				const flags = JSON.parse(sub.Flags ?? "{}");
				if (flags.skipPrivateReminder === true) {
					const platform = sb.Platform.get(sub.Platform ?? 1);
					await platform.send(message, sub.User_Alias);
				}
				else {
					await sb.Reminder.create({
						Channel: null,
						User_From: 1127,
						User_To: sub.User_Alias,
						Text: message,
						Schedule: null,
						Private_Message: true,
						Platform: sub.Platform ?? 1,
						Type: "Reminder"
					}, true);
				}
			}
		}

		const discord = sb.Platform.get("discord");
		const discordUpdatesRole = "748957148439904336";
		const channelData = sb.Channel.get("748955843415900280");

		for (const item of data) {
			const embed = {
				title: item.Type,
				url: `https://supinic.com/data/changelog/detail/${item.ID}`,
				description: `<@&${discordUpdatesRole}>`,
				timestamp: new sb.Date(item.Created).format("Y-m-d H:i:s"),
				fields: [
					{
						name: "Title",
						value: item.Title
					}
				]
			};

			if (item.Description) {
				embed.fields.push({
					name: "Description",
					value: item.Description
				});
			}

			await discord.send(null, channelData, {
				embeds: [embed]
			});
		}
	})
};
