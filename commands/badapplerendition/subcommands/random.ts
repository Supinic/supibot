import type { BadAppleRow, BadAppleSubcommandDefinition } from "../index.js";

export default {
	name: "random",
	aliases: ["roll"],
	title: "Random link",
	default: false,
	description: ["Rolls a random Bad Apple!! rendition from the list, and posts its details."],
	execute: async () => {
		const random = await core.Query.getRecordset<BadAppleRow | undefined>(rs => rs
			.select("ID", "Device", "Link", "Timestamp")
			.from("data", "Bad_Apple")
			.where("Status = %s", "Approved")
			.orderBy("RAND() DESC")
			.limit(1)
			.single()
		);

		if (!random) {
			return {
			    success: false,
			    reply: "There are no approved Bad Apple!! renditions available at the moment!"
			};
		}

		const timestamp = (random.Timestamp) ? `?t=${random.Timestamp}` : "";
		return {
			reply: core.Utils.tag.trim `
				Bad Apple!! on ${random.Device}
				https://youtu.be/${random.Link}${timestamp}
				https://supinic.com/data/bad-apple/detail/${random.ID}
			`
		};
	}
} satisfies BadAppleSubcommandDefinition;
