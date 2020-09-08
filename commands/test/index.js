module.exports = {
	Name: "test",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 2500,
	Description: "?",
	Flags: ["developer","pipe","skip-banphrase","system"],
	Whitelist_Response: "For debugging purposes only :)",
	Static_Data: null,
	Code: (async function test (context, ...args) {
		if (!context.append.flags) {
			return {
				reply: "No toxicity detected :)"
			};
		}
	
		const mapper = {
			S: "Sexual",
			P: "Profanity",
			I: "Identity",
			A: "Aggressive"
		};
	
		// console.log(context.append.flags);
	
		const counter = {};
		const words = context.append.flags.split(",");
		for (const word of words) {
			const [position, rest] = word.split(":");
			const scores = rest.split("/");
			for (const score of scores) {
				const [type, value] = score.split(".");	
				if (!type || !value) {
					continue;
				}
	
				if (typeof counter[type] === "undefined") {
					counter[type] = 0;
				}
	
				counter[type] += Number(value);
			}
		}
	
		const arr = Object.entries(counter).map(([key, value]) => `${mapper[key]}: ${value}`);
		return {
			reply: `Automod score: ${arr.join("; ")} -- Raw: ${context.append.flags}`
		}
	}),
	Dynamic_Description: null
};