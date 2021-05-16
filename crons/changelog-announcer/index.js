module.exports = {
	Name: "changelog-announcer",
	Expression: "0 * * * * *",
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
			.select("ID", "Title", "Type", "Description")
			.from("data", "Changelog")
			.where("ID > %n", this.data.latestID)
		);

		if (data.length === 0) {
			return;
		}

		const discordUpdatesRole = "748957148439904336";
		const discordChannel = sb.Channel.get("748955843415900280");
		const EmbedConstructor = sb.Platform.get("discord").controller.data.Embed ?? require("discord.js").MessageEmbed;

		for (const item of data) {
			const embed = new EmbedConstructor()
				.setTitle(`Changelog entry - ${item.Type}`)
				.setURL(`https://supinic.com/data/changelog/detail/${item.ID}`)
				.setDescription(item.Description ?? "(none)")
				.setFooter(`<@${discordUpdatesRole}>`);

			await discordChannel.send(embed);
		}

		this.data.latestID = Math.max(...data.map(i => i.ID));
	})
};