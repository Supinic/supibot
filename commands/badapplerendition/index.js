module.exports = {
	Name: "badapplerendition",
	Aliases: ["badapple", "bar"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for anything regarding the Bad Apple!! rendition list on the website.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		commands: [
			{
				name: "check",
				description: "Checks if your provided link is in the database, and creates a suggestion to add, if it isn't."
			},
			{
				name: "list",
				description: "Simply posts the link to the Bad Apple!! list."
			},
			{
				name: "random",
				description: "Rolls a random rendition from the list, and posts its details."
			}
		]
	})),
	Code: (async function badAppleRendition (context, command, ...args) {
		const commands = this.staticData.commands.map(i => i.name);
		if (!command) {
			return {
				success: false,
				reply: `No command provided! Use one of these: ${commands.join(", ")}`
			};
		}

		command = command.toLowerCase();
		switch (command) {
			case "check": {
				const input = args[0];
				const type = sb.Utils.linkParser.autoRecognize(input);
				if (type !== "youtube") {
					return {
						success: false,
						reply: `Cannot parse your link for YouTube! Only YT links are allowed now. `
					};
				}

				const link = sb.Utils.linkParser.parseLink(input);
				const existing = await sb.Query.getRecordset(rs => rs
					.select("ID", "Device", "Link")
					.from("data", "Bad_Apple")
					.where(`Link = %s OR JSON_SEARCH(Reuploads, "one", %s) IS NOT NULL`, link, link)
					.limit(1)
					.single()
				);

				if (existing) {
					return {
						reply: sb.Utils.tag.trim `
							Link is in the list already:
							https://supinic.com/data/bad-apple/detail/${existing.ID}
							Bad Apple!! on ${existing.Device}
							-
							https://youtu.be/${existing.Link}	
						`
					};
				}
				else {
					const data = await sb.Utils.linkParser.fetchData(input);
					const row = await sb.Query.getRow("data", "Bad_Apple");
					row.setValues({
						Link: link,
						Device: data.name,
						Status: "Pending approval",
						Type: null,
						Published: data.created,
						Notes: `Added to the list by ${context.user.Name}\n---\n${data.description ?? "No description"}`
					});

					const { insertId } = await row.save();
					return {
						reply: `Link added to the rendition list, pending approval: https://supinic.com/data/bad-apple/detail/${insertId}`
					};
				}
			}

			case "list": {
				return {
					reply: `🍎 https://supinic.com/data/bad-apple/list`
				};
			}

			case "random": {
				const random = await sb.Query.getRecordset(rs => rs
					.select("ID", "Device", "Link")
					.from("data", "Bad_Apple")
					.where("Status = %s", "Approved")
					.orderBy("RAND() DESC")
					.limit(1)
					.single()
				);

				return {
					reply: sb.Utils.tag.trim `
						Bad Apple!! on ${random.Device}
						https://youtu.be/${random.Link}	
						https://supinic.com/data/bad-apple/detail/${random.ID}
					`
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const staticData = values.getStaticData();
		const subcommands = staticData.commands.map(i => `<li><code>${prefix}bar ${i.name}</code><br>${i.description}</li>`);

		return [
			"Aggregate command for all things Bad Apple!! related.",
			"",

			`<ul>${subcommands.join("")}</ul>`
		];
	})
};
