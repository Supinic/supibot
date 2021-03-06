module.exports = {
	Name: "dankdebug",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dankDebug (context, ...args) {
		const script = `(() => {\n${args.join(" ")}\n})()`;

		let result;
		try {
			result = sb.Sandbox.run(script, {
				sandbox: null
			});
		}
		catch (e) {
			console.warn(e);
			return {
				success: false,
				reply: "Your dank debug ended with an error!"
			};
		}

		return {
			reply: `Result: ${result}`
		};
	}),
	Dynamic_Description: null
};