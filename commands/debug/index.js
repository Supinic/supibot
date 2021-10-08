module.exports = {
	Name: "debug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "supiniHack ",
	Flags: ["external-input","developer","pipe","skip-banphrase","system","use-params","whitelist"],
	Params: [
		{ name: "function", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function debug (context, ...args) {
		const permissions = await context.getUserPermissions();
		if (!permissions.is("administrator")) {
			return {
				success: false,
				reply: `Only administrators can access the debug command!`
			};
		}

		const vm = require("vm");
		const string = args.join(" ");

		let script;
		let scriptString;
		let scriptArgs;

		if (context.params.function) {
			scriptString = context.params.function;
			scriptArgs = [...args];
		}
		else if (!string.includes("return")) {
			scriptString = string;
		}
		else {
			scriptString = `(async () => {"use strict"; \n${string}\n})()`;
		}

		try {
			script = new vm.Script(scriptString);
		}
		catch (e) {
			return {
				reply: `Parse: ${e.toString()}`
			};
		}

		try {
			const scriptContext = vm.createContext({
				version: process.version,
				context,
				sb,
				args: scriptArgs ?? []
			});

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
				reply: `Execute: ${e.toString()}`
			};
		}
	}),
	Dynamic_Description: null
};
