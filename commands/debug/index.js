module.exports = {
	Name: "debug",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 0,
	Description: "supiniHack ",
	Flags: ["developer","pipe","skip-banphrase","system","whitelist"],
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
			const ForeignObject = vm.runInContext("Object", scriptContext);
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
	})
	
	
	/*
	async (extra, ...args) => {
		try {
			const result = await eval("(async () => {\n" + args.join(" ") + "\n})()");
			if (typeof result !== "undefined") {
				return { reply: String(result) };
			}
			else {
				return { reply: "Done" };
			}
		}
		catch (e) {
			console.log(e);
			return { reply: "Error: " + e.toString() };
		}
	}
	*/,
	Dynamic_Description: null
};