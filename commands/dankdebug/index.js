module.exports = {
	Name: "dankdebug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dankDebug (context, ...args) {
		const vm = require("vm");
		const scriptCode = args.join(" ");
	
		if (scriptCode.includes("this")) {
			return {
				reply: "FeelsDankMan You are trying outdank me, can't allow that!"
			};
		}
	
		let script;
		try {
			script = new vm.Script(`(async function debugee () {\n${args.join(" ")}\n})()`);
		}
		catch (e) {
			return {
				reply: "FeelsDankMan Your code is not dank enough! " + e.toString()
			};
		}
	
		try {
			const result = await script.runInNewContext({}, {timeout: 1000});
			if (typeof result === "undefined") {
				return {
					reply: "FeelsDankMan Your code is dank, but returned nothing..."
				};
			}
			else {
				return {
					reply: "FeelsDankMan " + String(result)
				};
			}
		}
		catch (e) {
			return {
				reply: "FeelsDankMan Your code is too dank! " + e.toString()
			};
		}
	}),
	Dynamic_Description: null
};