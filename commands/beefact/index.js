export default {
	Name: "beefact",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random fact about bees.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function beeFact () {
		const fact = await core.Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Fun_Fact")
			.where("Tag = %s", "Bees")
			.orderBy("RAND()")
			.limit(1)
			.single()
		);

		return {
			reply: `🐝 ${fact.Text}`
		};
	}),
	Dynamic_Description: null
};
