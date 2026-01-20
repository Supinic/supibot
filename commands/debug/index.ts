import { Script, createContext } from "node:vm";
import crypto from "node:crypto";
import { declare } from "../../classes/command.js";

export default declare({
	Name: "debug",
	Aliases: null,
	Cooldown: 0,
	Description: "supiniHack",
	Flags: ["external-input", "developer", "pipe", "skip-banphrase", "system", "whitelist"],
	Params: [
		{ name: "force", type: "boolean" },
		{ name: "function", type: "string" },
		{ name: "importGist", type: "string" }
	],
	Whitelist_Response: "Only administrators can access the debug command!",
	Code: (async function debug (context, ...args) {
		const permissions = await context.getUserPermissions();
		if (!permissions.is("administrator")) {
			return {
				success: false,
				reply: `Only administrators can access the debug command!`
			};
		}

		const string = args.join(" ");
		let scriptString;
		let scriptArgs;

		let importedText;
		if (context.params.importGist) {
			if (context.params.importGist.includes(" ")) {
				return {
					success: false,
					reply: `Gist IDs cannot contain spaces!`
				};
			}

			const gistCommand = sb.Command.getAsserted("pastebin");
			const fakeCtx = sb.Command.createFakeContext(
				gistCommand,
				{
					// eslint-disable-next-line @typescript-eslint/no-misused-spread
					...context,
					params: {
						force: Boolean(context.params.force)
					},
					invocation: "gist"
				}
			);

			const gistResult = await gistCommand.execute(fakeCtx, context.params.importGist);
			if (gistResult.success === false || typeof gistResult.reply !== "string") {
				return gistResult;
			}

			importedText = gistResult.reply;
			if (!importedText.endsWith(";") && !importedText.endsWith(",")) {
				importedText += ";";
			}
		}

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

		if (importedText) {
			scriptString = `${importedText}${scriptString}`;
		}

		let script;
		try {
			script = new Script(scriptString);
		}
		catch (e) {
			console.log(e);
			return {
				success: false,
				reply: `Parse: ${String(e)}`
			};
		}

		try {
			const scriptContext = createContext({
				crypto,
				version: process.version,
				context,
				sb,
				core,
				args: scriptArgs ?? []
			});

			let result = await script.runInNewContext(scriptContext, { timeout: 2500 }) as unknown;
			if (typeof result !== "undefined") {
				if (result?.constructor.name === "Object") {
					result = JSON.stringify(result, null, 4);
				}

				return {
					success: true,
					reply: String(result)
				};
			}
			else {
				return {
					success: true,
					reply: "Done"
				};
			}
		}
		catch (e) {
			console.log(e);
			return {
				success: false,
				reply: `Execute: ${String(e)}`
			};
		}
	}),
	Dynamic_Description: null
});
