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
		const scriptArgs = context.params.arguments ?? "";
		const script = `((...args) => {\n${args.join(" ")}\n})(${scriptArgs})`;

		let result;
		try {
			result = sb.Sandbox.run(script, {
				sandbox: {
					rawArguments: scriptArgs
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

		return {
			reply: `Result: ${result}`
		};
	}),
	Dynamic_Description: null
};