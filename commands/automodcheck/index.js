module.exports = {
	Name: "automodcheck",
	Aliases: ["amc"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "For a Twitch message outside of whispers, this command will show you how AutoMod sees it - posting how offensive it is in several categories.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function test (context) {
		if (context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: "Can't check for AutoMod outside of Twitch!"
			};
		}
		else if (context.privateMessage) {
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
			A: "aggressive",
			I: "identity",
			P: "profanity",
			S: "sexual",
			unknown: "unknown"
		};
	
		let total = 0;
		const counter = {};
		const words = context.append.flags.split(",");
		for (const word of words) {
			const [positions, rest] = word.split(":");
			if (!rest) {
				return {
					reply: `AutoMod detected something at positions ${positions}, but sent no category score.`
				};
			}
	
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
				total += Number(value);
			}
		}
	
		const arr = Object.entries(counter).map(([key, value]) => `${mapper[key]}: ${value}`);
		return {
			reply: `AutoMod score: ${total}. Categories: ${arr.join(", ")}`
		};
	}),
	Dynamic_Description: null
};
