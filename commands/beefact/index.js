module.exports = {
	Name: "beefact",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random fact about bees.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function beeFact () {
		const fact = await sb.Query.getRecordset(rs => rs
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