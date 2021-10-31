module.exports = {
	Name: "dankdebug",
	Aliases: ["js"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Debug command for public use, which means it's quite limited because of security.",
	Flags: ["external-input","developer","mention","pipe","use-params"],
	Params: [
		{ name: "arguments", type: "string" },
		{ name: "errorInfo", type: "boolean" },
		{ name: "force", type: "boolean" },
		{ name: "function", type: "string" },
		{ name: "importGist", type: "string" }
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
			script = `${importedText}${script}`;
		}

		try {
			const scriptContext = {
				fixAsync: false,
				sandbox: {
					aliasStack: (context.append.aliasStack)
						? [...context.append.aliasStack]
						: [],
					args: scriptArgs ?? null,
					channel: context.channel?.Name ?? "(none)",
					console: undefined,
					executor: context.user.Name,
					platform: context.platform.Name,
					tee: Object.freeze([...context.tee]),
					utils: {
						getEmote: (array, fallback) => {
							if (!Array.isArray(array) || array.some(i => typeof i !== "string")) {
								throw new Error("Emotes must be provided as an Array containing strings only");
							}

							return context.getBestAvailableEmote(array, fallback);
						}
					}
				}
			};

			for (const method of this.staticData.allowedUtilsMethods) {
				scriptContext.sandbox.utils[method] = (...args) => sb.Utils[method](...args);
			}

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
					reply: `${e.toString()} - More info: ${link}`
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
