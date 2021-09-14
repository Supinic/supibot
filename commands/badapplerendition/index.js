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
				const processed = new Set();
				const results = [];
				const fixedArgs = args.flatMap(i => i.split(/\s+/).filter(Boolean));

				for (const input of fixedArgs) {
					const type = sb.Utils.modules.linkParser.autoRecognize(input);
					if (type !== "youtube") {
						continue;
					}

					const link = sb.Utils.modules.linkParser.parseLink(input);
					if (processed.has(link)) {
						continue;
					}
					else {
						processed.add(link);
					}

					const existing = await sb.Query.getRecordset(rs => rs
						.select("ID", "Device", "Link")
						.from("data", "Bad_Apple")
						.where(`Link = %s OR JSON_SEARCH(Reuploads, "one", %s) IS NOT NULL`, link, link)
						.limit(1)
						.single()
					);

					if (existing) {
						results.push({
							input,
							reply: sb.Utils.tag.trim `
								Link is in the list already:
								https://supinic.com/data/bad-apple/detail/${existing.ID}
								Bad Apple!! on ${existing.Device}
								-
								https://youtu.be/${existing.Link}	
							`
						});
						continue;
					}

					const data = await sb.Utils.modules.linkParser.fetchData(input);
					if (!data) {
						results.push({
							input,
							reply: `Video is not available!`
						});

						continue;
					}

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
					results.push({
						input,
						reply: `Link added to the rendition list, pending approval: https://supinic.com/data/bad-apple/detail/${insertId}`
					});
				}

				if (results.length === 0) {
					return {
						success: false,
						reply: `No proper links provided!`
					};
				}
				else if (results.length === 1) {
					return {
						reply: results[0].reply
					};
				}
				else {
					const summary = results.map(i => `${i.input}\n${i.reply}`).join("\n\n");
					const paste = await sb.Pastebin.post(summary);
					if (paste.success !== true) {
						return {
							reply: `${results.length} videos processed. No summary available - ${paste.error ?? paste.body}`
						};
					}

					return {
						reply: `${results.length} videos processed. Summary: ${paste.body}`
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
