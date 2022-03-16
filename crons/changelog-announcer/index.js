module.exports = {
	Name: "changelog-announcer",
	Expression: "0 */30 * * * *",
	Description: "Watches for new changelogs, and if found, posts them to the specified channel(s).",
	Defer: null,
	Type: "Bot",
	Code: (async function changelogAnnouncer () {
		if (typeof this.data.latestID === "undefined") {
			this.data.latestID = await sb.Query.getRecordset(rs => rs
				.select("MAX(ID) AS Max")
				.from("data", "Changelog")
				.single()
				.flat("Max")
			);

			return;
		}

		const data = await sb.Query.getRecordset(rs => rs
			.select("ID", "Created", "Title", "Type", "Description")
			.from("data", "Changelog")
			.where("ID > %n", this.data.latestID)
		);

		if (data.length === 0) {
			return;
		}

		const subscriptions = await sb.Query.getRecordset(rs => rs
			.select("User_Alias", "Platform")
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
				const relay = await sb.Got("Supinic", {
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
				sb.Reminder.create({
					Channel: null,
					User_From: 1127,
					User_To: sub.User_Alias,
					Text: message,
					Schedule: null,
					Created: new sb.Date(),
					Private_Message: true,
					Platform: sub.Platform ?? 1
				}, true);
			}
		}

		const discord = sb.Platform.get("discord");
		const discordUpdatesRole = "748957148439904336";
		const discordChannel = await discord.client.channels.fetch("748955843415900280");
		const EmbedConstructor = discord.controller.data.Embed ?? require("discord.js").MessageEmbed;

		for (const item of data) {
			const embed = new EmbedConstructor()
				.setTitle(item.Type)
				.setURL(`https://supinic.com/data/changelog/detail/${item.ID}`)
				.setTimestamp(new sb.Date(item.Created))
				.addField("Title", item.Title);

			if (item.Description) {
				embed.addField("Description", item.Description);
			}

			await discordChannel.send({
				content: `<@&${discordUpdatesRole}>`,
				embeds: [embed]
			});
		}

		this.data.latestID = Math.max(...data.map(i => i.ID));
	})
};
