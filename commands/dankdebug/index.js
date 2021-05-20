module.exports = {
	Name: "dankdebug",
	Aliases: ["js"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["external-input","developer","mention","pipe","use-params"],
	Params: [
		{ name: "arguments", type: "string" },
		{ name: "function", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		allowedUtilsMethods: [
			"capitalize",
			"randArray",
			"random",
			"randomString",
			"removeAccents",
			"timeDelta",
			"wrapString",
			"zf"
		]
	})),
	Code: (async function dankDebug (context, ...args) {
		let scriptArgs;
		if (context.params.arguments) {
			if (context.params.function) {
				return {
					success: false,
					reply: `Cannot combine arguments and function params together!`
				};
			}
			
			try {
				scriptArgs = JSON.parse(context.params.arguments);
			}
			catch (e) {
				return {
					success: false,
					reply: `Command arguments cannot be parsed! ${e.message}`
				};
			}
		}

		let result;
		let script;
		const string = args.join(" ");

		if (context.params.function) {
			script = context.params.function;
			scriptArgs = args;
		}
		else if (!string.includes("return")) {
			script = string;
		}
		else {
			script = `await (async () => {\n${string}\n})()`;
		}
		
		try {
			const scriptContext = {
				fixAsync: false,
				sandbox: {
					args: scriptArgs ?? null,
					executor: context.user.Name,
					channel: context.channel?.Name ?? "(none)",
					platform: context.platform.Name,
					console: undefined,
					utils: {
						getEmote: (array, fallback) => context.getBestAvailableEmote(array, fallback),
						Date: sb.Date
					}
				}
			};

			for (const method of this.staticData.allowedUtilsMethods) {
				scriptContext.sandbox.utils[method] = (...args) => sb.Utils[method](...args);
			}

			result = sb.Sandbox.run(script, scriptContext);
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
					reply: require("util").inspect(result)
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
				reply: String(result)
			};
		}
	}),
	Dynamic_Description: null
};