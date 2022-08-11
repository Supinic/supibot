module.exports = {
	Name: "dankdebug",
	Aliases: ["js"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["external-input","developer","mention","pipe"],
	Params: [
		{ name: "arguments", type: "string" },
		{ name: "errorInfo", type: "boolean" },
		{ name: "force", type: "boolean" },
		{ name: "function", type: "string" },
		{ name: "importGist", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		customDataLimit: 1_000_000
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

		let importedText;
		if (context.params.importGist) {
			if (context.params.importGist.includes(" ")) {
				return {
					success: false,
					reply: `Gist IDs cannot contain spaces!`
				};
			}

			const gistCommand = sb.Command.get("pastebin");
			const fakeCtx = sb.Command.createFakeContext(
				gistCommand,
				{
					...context,
					params: {
						force: Boolean(context.params.force)
					},
					invocation: "gist"
				},
				{}
			);

			const gistResult = await gistCommand.execute(fakeCtx, context.params.importGist);
			if (gistResult.success === false) {
				return gistResult;
			}

			importedText = gistResult.reply;

			if (!importedText.endsWith(";") && !importedText.endsWith(",")) {
				importedText += ";";
			}
		}

		let result;
		let script;
		const string = args.join(" ");

		if (context.params.function) {
			script = context.params.function;
			scriptArgs = [...args];
		}
		else if (!string.includes("return")) {
			script = string;
		}
		else {
			script = `(async () => {\n${string}\n})()`;
		}

		if (importedText) {
			script = `${importedText}\n${script}`;
		}

		const createSandbox = require("./create-sandbox");
		const sandboxData = await createSandbox(context, scriptArgs);

		const scriptContext = {
			fixAsync: false,
			sandbox: sandboxData.sandbox
		};
		try {
			result = await sb.Sandbox.run(script, scriptContext);
		}
		catch (e) {
			if (!(e instanceof Error)) {
				return {
					success: false,
					reply: `Your dank debug threw or rejected with a non-Error value!`
				};
			}

			const { name } = e.constructor;
			if (name === "EvalError") {
				return {
					success: false,
					reply: "Your dank debug contains code that isn't allowed!"
				};
			}

			let errorDescription = e.toString?.();
			if (!errorDescription) {
				errorDescription = (typeof e.message === "string")
					? e.message
					: "(nondescript error)";
			}

			if (context.params.errorInfo) {
				const stack = e.stack.split(/\r?\n/);
				const lastLine = stack.findIndex(i => i.includes("Script.runInContext"));
				const text = JSON.stringify({
					script,
					stack: stack.slice(0, lastLine)
				}, null, 4);

				const paste = await sb.Pastebin.post(text, {
					name: "Full error info for $js",
					expiration: "1H",
					format: "json"
				});

				const link = (paste.success) ? paste.body : paste.error;
				return {
					success: false,
					reply: `${errorDescription} - More info: ${link}`
				};
			}

			return {
				success: false,
				reply: errorDescription
			};
		}

		const channelDataResult = await sandboxData.handleChannelDataChange(this.staticData.limit);
		if (channelDataResult.success === false) {
			return channelDataResult;
		}

		const userDataResult = await sandboxData.handleUserDataChange(this.staticData.limit);
		if (userDataResult.success === false) {
			return channelDataResult;
		}

		if (result && typeof result === "object") {
			try {
				if (typeof result.toJSON === "function") {
					return {
						reply: String(result.toJSON())
					};
				}

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
				cooldown: (context.append.pipe) ? null : this.Cooldown,
				reply: String(result)
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Runs JavaScript in a sandboxed VM, with access to specific methods and variables relating to supibot and the current command context.",
		`This description assumes you already know JavaScript, it only goes over a brief overview of how the ${prefix}dankdebug command works, and caveats specific to the command.`,
		`For an extensive look at all of the variables and methods available within the dankdebug context, see <a target="_blank" href="//github.com/supinic/supibot-package-manager/tree/master/commands/dankdebug/">these files</a>.`,
		"",

		`<code>${prefix}js (JavaScript code)</code>`,
		"Runs your code, and replies with the result value. If there is no return, the last statement's value is used, e.g.:",
		`<code>${prefix}js 0x100 * 2</code> => <code>512</code>`,
		`<code>${prefix}js let array = [ 'foo', 'bar', 'baz' ]; array.pop()</code> => <code>baz</code>`,
		"Note: If your code contains <code>return</code> <em>anywhere</em>, it will be wrapped in an async function, e.g.:",
		`<code>${prefix}js return 0x100 * 2</code> => <code>512</code>`,
		`<code>${prefix}js let array = [ 'foo', 'bar', 'baz' ]; return array.pop()</code> => <code>baz</code>`,
		`<code>${prefix}js let array = [ 'foo', 'foo_return_bar', 'baz' ]; array.pop()</code> => <code>undefined</code>`,
		`<code>${prefix}js let array = [ 'foo', 'foo_return_bar', 'baz' ]; return array.pop()</code> => <code>baz</code>`,
		"",

		`<code>${prefix}js errorInfo:true (JavaScript code)</code>`,
		"Runs your code as normal, but if there is an error, it will post a link to where you can view the entire call stack and script, e.g.:",
		`<code>${prefix}js errorInfo:true throw new Error('Critical error!')</code> => <code>Error: Critical error! - More info: &lt;link&gt;</code>`,
		"If there is an error without <code>errorInfo:true</code> provided, only the error message is provided back.",
		`<code>${prefix}js throw new Error('Critical error!')</code> => <code>Error: Critical error!</code>`,
		"",

		`<code>${prefix}js function:"(JavaScript code)"</code>`,
		"Runs the function provided inside the parameter. Using return in this context without providing your own function wrapping your code is a syntax error.",
		"When the command in invoked in this way the <code>args</code> variable set to a string array of the input, e.g.:",
		`<code>${prefix}js function:args foo bar baz</code> => <code>[ 'foo', 'bar', 'baz' ]</code>`,
		`<code>${prefix}js function:"let len = args.length; len"</code> => <code>0</code>`,
		`<code>${prefix}js function:"(()=>{ return args[1] })()" foo bar</code> => <code>bar</code>`,
		"",

		`<code>${prefix}js arguments:"(JSON value)"</code>`,
		"Sets the <code>args</code> variable to the parsed JSON written in the arguments parameter.",
		"Because the arguments parameter and the function parameter both control the value of the <code>args</code> variable, you cannot use them together.",
		`<code>${prefix}js arguments:"{ \\"foo\\": \\"bar\\", \\"dank\\": true }" return args.foo;</code> => <code>bar</code>`,
		`<code>${prefix}js arguments:false return args;</code> => <code>false</code>`,
		`<code>${prefix}js arguments:127 return args;</code> => <code>127</code>`,
		"",

		`<code>${prefix}js importGist:(gist ID)</code>`,
		`<code>${prefix}js importGist:(gist ID) force:true</code>`,
		`Prepends a GitHub gist to the beginning of your code before running it. For more information about file selection, caching, and length limits, see the <a href="/bot/command/detail/pastebin">${prefix}pastebin</a> command.`,
		`The force parameter does the same as in the <a href="/bot/command/detail/pastebin">${prefix}pastebin</a> command, and skips caching when fetching the gist.`
	])
};
