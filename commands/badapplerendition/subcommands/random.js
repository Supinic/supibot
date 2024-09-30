module.exports = {
	name: "random",
	aliases: [],
	description: "Rolls a random rendition from the list, and posts its details.",
	execute: async () => {
		const random = await sb.Query.getRecordset(rs => rs
			.select("ID", "Device", "Link", "Timestamp")
			.from("data", "Bad_Apple")
			.where("Status = %s", "Approved")
			.orderBy("RAND() DESC")
			.limit(1)
			.single()
		);

		const timestamp = (random.Timestamp) ? `?t=${random.Timestamp}` : "";
		return {
			reply: sb.Utils.tag.trim `
				Bad Apple!! on ${random.Device}
				https://youtu.be/${random.Link}${timestamp}
				https://supinic.com/data/bad-apple/detail/${random.ID}
			`
		};
	}
};
