module.exports = {
	Name: "debug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "supiniHack ",
	Flags: ["external-input","developer","pipe","skip-banphrase","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function debug (context, ...args) {
		const vm = require("vm");
		let script = null;	
	
		try {
			script = new vm.Script(`(async () => {\n"use strict";\n${args.join(" ")}\n})()`);
		}
		catch (e) {
			return {
				reply: "Parse: " + e.toString()
			};
		}
	
		try {
			const scriptContext = vm.createContext({version: process.version, context, sb});
			let result = await script.runInNewContext(scriptContext, { timeout: 2500 });
			if (typeof result !== "undefined") {
				if (result?.constructor?.name === "Object") {
					result = JSON.stringify(result, null, 4);
				}
	
				return {
					reply: String(result)
				};
			}
			else {
				return { 
					reply: "Done"
				};
			}
		}
		catch (e) {
			console.log(e);
			return { 
				reply: "Execute: " + e.toString()
			};
		}		
	}),
	Dynamic_Description: null
};