import { SupiDate, SupiError } from "supi-core";

import { postToHastebin } from "../../../utils/command-utils.js";
import getLinkParser from "../../../utils/link-parser.js";
import type { BadAppleSubcommandDefinition, BadAppleRow } from "../index.js";

export default {
	name: "check",
	aliases: ["add"],
	title: "New video",
	default: false,
	description: [
		"Checks if your provided link is in the database, and creates a suggestion to add, if it isn't."
	],
	execute: async (context, ...args) => {
		const linkParser = await getLinkParser();
		const processed = new Set();
		const results = [];

		const fixedArgs = args.flatMap(i => i.split(/\s+/).filter(Boolean));
		for (const input of fixedArgs) {
			const type = linkParser.autoRecognize(input);
			if (type !== "youtube") {
				continue;
			}

			const link = linkParser.parseLink(input);
			if (processed.has(link)) {
				continue;
			}
			else {
				processed.add(link);
			}

			const existing = await core.Query.getRecordset<BadAppleRow | undefined>(rs => rs
				.select("ID", "Device", "Link", "Timestamp")
				.from("data", "Bad_Apple")
				.where(`Link = %s OR JSON_SEARCH(Reuploads, "one", %s) IS NOT NULL`, link, link)
				.limit(1)
				.single()
			);

			if (existing) {
				const timestamp = (existing.Timestamp) ? `?t=${existing.Timestamp}` : "";
				results.push({
					input,
					reply: core.Utils.tag.trim `
						Link is in the list already:
						https://supinic.com/data/bad-apple/detail/${existing.ID}
						Bad Apple!! on ${existing.Device}
						-
						https://youtu.be/${existing.Link}${timestamp}
					`
				});

				continue;
			}

			const data = await linkParser.fetchData(input);
			if (!data) {
				results.push({
					input,
					reply: `Video is not available!`
				});

				continue;
			}

			const row = await core.Query.getRow("data", "Bad_Apple");
			row.setValues({
				Link: link,
				Device: data.name,
				Status: "Pending approval",
				Type: null,
				Published: (data.created) ? new SupiDate(data.created) : null,
				Notes: `Added to the list by ${context.user.Name}\n---\n${data.description ?? "No description"}`
			});

			const saveResult = await row.save({ skipLoad: true });
			if (!saveResult || !("insertId" in saveResult)) {
				throw new SupiError({
				    message: "Assert error: No updated columns in Row"
				});
			}

			const { insertId } = saveResult;
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
			const paste = await postToHastebin(summary);
			if (!paste.ok) {
				return {
					success: false,
					reply: paste.reason
				};
			}

			return {
				reply: `${results.length} videos processed. Summary: ${paste.link}`
			};
		}
	}
} satisfies BadAppleSubcommandDefinition;
