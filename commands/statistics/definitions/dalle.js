export default {
	name: "dalle",
	aliases: ["dall-e"],
	description: "Statistics related to the DALL-E generated images via $dalle",
	execute: async (/* context , type */) => {
		const amount = await core.Query.getRecordset(rs => rs
			.select("COUNT(*) AS Amount")
			.from("data", "DALL-E")
			.single()
			.flat("Amount")
		);

		return {
			reply: `So far, ${core.Utils.groupDigits(amount)} DALL-E image sets have been created via the $dalle command.`
		};
	}
};
