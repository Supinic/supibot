import { CommandDefinition } from "../../classes/command.js";

export default {
	Name: "beefact",
	Aliases: null,
	Cooldown: 10_000,
	Description: "Posts a random fact about bees.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function beeFact () {
		const fact = await core.Query.getRecordset<string>(rs => rs
			.select("Text")
			.from("data", "Fun_Fact")
			.where("Tag = %s", "Bees")
			.orderBy("RAND()")
			.limit(1)
			.flat("Text")
			.single()
		);

		return {
			reply: `🐝 ${fact}`
		};
	}),
	Dynamic_Description: null
} satisfies CommandDefinition;
