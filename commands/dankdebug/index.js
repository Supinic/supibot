module.exports = {
	Name: "dankdebug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["developer","pipe","use-params"],
	Params: [
		{ name: "arguments", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dankDebug (context, ...args) {
		let scriptArgs;
		if (context.params.arguments) {
			try {
				scriptArgs = JSON.parse(context.params.arguments);
			}
			catch (e) {
				console.warn(e);
				return {
					success: false,
					reply: `Command arguments cannot be parsed! ${e.message}`
				};
			}
		}

		let result;
		const script = `(() => {\n${args.join(" ")}\n})()`;
		try {
			result = sb.Sandbox.run(script, {
				sandbox: {
					args: scriptArgs ?? null
				}
			});
		}
		catch (e) {
			const { name } = e.constructor;
			if (name === "EvalError") {
				return {
					success: false,
					reply: "Your dank debug cannot contain any asynchronous code!"
				};
			}

			return {
				success: false,
				reply: e.toString()
			};
		}

		const { inspect } = require("util");
		return {
			reply: (result && typeof result === "object")
				? `Result: ${inspect(result)}`
				: `Result: ${result}`
		};
	}),
	Dynamic_Description: null
};