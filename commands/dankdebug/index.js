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
			catch {
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
					args: scriptArgs ?? null,
					console: undefined,
					utils: {
						random: (...args) => sb.Utils.random(...args),
						capitalize: (...args) => sb.Utils.capitalize(...args),
						timeDelta: (...args) => sb.Utils.timeDelta(...args),
						Date: sb.Date
					}
				}
			});
		}
		catch (e) {
			const { name } = e.constructor;
			if (name === "EvalError") {
				return {
					success: false,
					reply: "Your dank debug contains code that isn't allowed!"
				};
			}

			return {
				success: false,
				reply: e.toString()
			};
		}

		if (result && typeof result === "object") {
			try {
				return {
					reply: "Result: " + require("util").inspect(result)
				};
			}
			catch (e) {
				console.warn(e);
				return {
					success: false,
					reply: "Your dank debug's return value cannot be serialized!"
				};
			}
		}
		else {
			return {
				reply: `Result: ${result}`
			};
		}
	}),
	Dynamic_Description: null
};