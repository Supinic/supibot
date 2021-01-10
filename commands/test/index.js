module.exports = {
	Name: "test",
	Aliases: null,
	Author: "supinic",
	Cooldown: 2500,
	Description: "?",
	Flags: ["developer","pipe","skip-banphrase","system"],
	Whitelist_Response: "For debugging purposes only :)",
	Static_Data: null,
	Code: (async function test (context) {
		if (context.privateMessage) {
			return {
				success: false,
				reply: "Can't check for toxicity in whispers!"
			};
		}
		else if (!context.append.flags) {
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