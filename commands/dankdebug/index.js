const { VM } = require("vm2");
const { preventTomfoolery } = require("./anti-tomfoolery.js");

const PREFIX_SAFETY_CODE = `Object.defineProperty(Promise.prototype, "constructor", { writable: false }); Object.freeze(Promise.prototype); void 0;`;
const MAXIMUM_DATA_LENGTH = 1_000_000;
const DEFAULT_VM_OPTIONS = {
	sandbox: {},
	compiler: "javascript",
	eval: false,
	wasm: false,
	fixAsync: true,
	timeout: 5000
};
const executeScriptVm = (script, options) => {
	const vm = new VM({
		...DEFAULT_VM_OPTIONS,
		...options
	});

	return vm.run(script);
};

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
	initialize: () => {
		preventTomfoolery();
	},
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

		let importedText = "\n";
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

			importedText += "\n";
		}

		let result;
		let script;
		const string = args.join(" ");

		if (context.params.function) {
			script = `${PREFIX_SAFETY_CODE}\n${importedText}${context.params.function}`;
			scriptArgs = [...args];
		}
		else if (!string.includes("return")) { // @todo refactor this to use acorn heuristic for ReturnStatement
			script = `${PREFIX_SAFETY_CODE}\n${importedText}${string}`;
		}
		else {
			script = `${PREFIX_SAFETY_CODE}\n${importedText}(async () => {\n${string}\n})()`;
		}

		const { analyze } = require("./acorn-heuristic.js");
		const analyzeResult = analyze(script);
		if (analyzeResult.illegalAsync) {
			return {
				success: false,
				reply: "Your execution contains illegal asynchronous code!"
			};
		}

		const createSandbox = require("./create-sandbox");
		const sandboxData = await createSandbox(context, scriptArgs);
		try {
			result = await executeScriptVm(script, {
				fixAsync: false,
				timeout: 2400,
				sandbox: sandboxData.sandbox
			});
		}
		catch (e) {
			// Special case - error is coming directly from VM2-land, and isn't `instanceof` this realm's `Error`
			if (e?.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
				return {
					success: false,
					reply: `Your execution timed out!`
				};
			}
			else if (e?.message?.includes("Asynchronous execution timed out")) {
				await sb.Logger.log(
					"Command.Warning",
					`$js: Async execution timed out: ${context.user.Name} exceeded async timeout in ${context.channel?.Name ?? "whispers"}`
				);
			}
			else if (!(e instanceof Error) && e?.constructor?.name !== "Error") {
				return {
					success: false,
					reply: `Your execution threw or rejected with a non-Error value!`
				};
			}

			const { name } = e.constructor;
			if (name === "EvalError") {
				return {
					success: false,
					reply: "Your execution contains code that isn't allowed!"
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

		const channelDataResult = await sandboxData.handleChannelDataChange(MAXIMUM_DATA_LENGTH);
		if (channelDataResult.success === false) {
			return channelDataResult;
		}

		const userDataResult = await sandboxData.handleUserDataChange(MAXIMUM_DATA_LENGTH);
		if (userDataResult.success === false) {
			return userDataResult;
		}

		let cooldown = (context.append.pipe) ? null : this.Cooldown;
		const overrideCooldown = sandboxData.determineCommandCooldown();
		if (overrideCooldown !== null) {
			cooldown = overrideCooldown;
		}

		if (result && typeof result === "object") {
			try {
				return {
					reply: JSON.stringify(result, null, 1)
				};
			}
			catch (e) {
				console.warn(e);
				return {
					success: false,
					reply: "Your execution's return value cannot be serialized!"
				};
			}
		}
		else {
			return {
				cooldown,
				reply: String(result)
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Runs JavaScript in a sandboxed VM, with access to specific methods and variables relating to supibot and the current command context.",
		`This description assumes you already know JavaScript, it only goes over a brief overview of how the ${prefix}dankdebug command works, and caveats specific to the command.`,
		`For an extensive look at all of the variables and methods available within the dankdebug context, see <a target="_blank" href="//github.com/supinic/supibot/tree/master/commands/dankdebug/">these files</a>.`,
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
