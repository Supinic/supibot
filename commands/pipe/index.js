module.exports = {
	Name: "pipe",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Pipes the result of one command to another, and so forth. Each command will be used as if used separately, so each will be checked for cooldowns and banphrases. Use the character \"|\" or \">\" to separate each command.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pipe (context, ...args) {
		const invocations = args.join(" ").split(/[|>]/).map(i => i.trim());
		if (!context.externalPipe && invocations.length < 2) {
			return { reply: "At least two commands must be piped together!" };
		}
	
		let aliased = false;
		const nullCommand = sb.Command.get("null");
		for (let i = 0; i < invocations.length; i++) {
			const [commandString] = invocations[i].split(" ");
			const command = sb.Command.get(commandString.replace(sb.Command.prefixRegex, ""));
	
			if (!command) {
				return {
					success: false,
					reply: `Command "${commandString}" does not exist!`
				};
			}
			else if (!command.Flags.pipe && invocations[i + 1]) {
				return {
					success: false,
					reply: `Output of command "${commandString}" cannot be piped!`
				};
			}
			else if (nullCommand && command.Flags.nonNullable && invocations[i + 1]) {
				const [nextCommandString] = invocations[i + 1].split(" ");
				const nextCommand = sb.Command.get(nextCommandString.replace(sb.Command.prefixRegex, ""));
				if (nextCommand && nextCommand.Name === nullCommand.Name) {
					return {
						success: false,
						reply: `The output of command "${commandString}" cannot be directly piped into null!`
					};
				}
			}
			else if (command.Name === "alias") {
				aliased = true;
			}
		}
	
		const resultsInPastebin = args[args.length - 1] === "pastebin";
		let finalResult = null;
		let currentArgs = [];
	
		for (const inv of invocations) {
			let [cmd, ...cmdArgs] = inv.split(" ");
			cmdArgs = cmdArgs.concat(currentArgs);
	
			const check = sb.Command.get(cmd.replace(sb.Command.prefix, ""));
			if (check) {
				if (["randomgachi", "current"].includes(check.Name)) {
					cmdArgs.push("linkOnly:true");
				}
				else if (check.Name === "translate") {
					cmdArgs.push("direction:false", "confidence:false");
				}
			}
	
			const result = await sb.Command.checkAndExecute(
				cmd,
				cmdArgs,
				context.channel,
				context.user,
				{
					...context.append,
					platform: context.platform,
					pipe: true,
					skipBanphrases: true,
					skipPending: true,
					skipMention: true,
					partialExecute: true
				}
			);
	
			if (!result) { // Banphrase result: Do not reply
				currentArgs = [];
			}
			else if (typeof result !== "object") { // Banphrase result: Reply with message
				return {
					reply: result
				};
			}
			else if (result.reason === "bad_invocation" && result.reply) {
				return {
					success: false,
					reply: `Command "${cmd}" failed: ${result.reply}`
				};
			}
			else if (result.reason === "error" && result.reply) {
				return {
					success: false,
					reply: result.reply
				};
			}
			else if (result.success === false) { // Command result: Failed (cooldown, no command, ...)
				let reply = "";
				switch (result.reason) {
					case "no-command": reply = "Not a command!"; break;
					case "pending": reply = "Another command still being executed!"; break;
					case "cooldown": reply = "Still on cooldown!"; break;
					case "filter": reply = "You can't use this command here!"; break;
					case "block": reply = "That user has blocked you from this command!"; break;
					case "opt-out": reply = "That user has opted out from this command!"; break;
					case "pipe-nsfw": reply = "You cannot pipe NSFW results!"; break;
	
					default: reply = result.reason ?? result.reply;
				}
	
				return {
					success: false,
					reply: `Pipe will not continue, because command ${cmd} failed: ${reply}`
				};
			}
			else if (!result.reply) {
				return {
					success: false,
					reply: "Empty pipe result!"
				};
			}
			else if (resultsInPastebin) {
				currentArgs = result.reply.split(" ");
			}
			else {
				currentArgs = sb.Utils.wrapString(result.reply, 2000).split(" ");
			}
	
			finalResult = result;
		}
	
		return {
			aliased,
			replyWithPrivateMessage: Boolean(finalResult?.replyWithPrivateMessage),
			reply: currentArgs.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Pipes multiple commands together, where each command's result will become the input of another.",
			"Separate the commands with <code>|</code> or <code>&gt;</code> characters.",
			"",
			
			`<code>${prefix}pipe news RU | translate</code>`,
			"Fetches russian news, and immediately translates them to English (by default).",
			"",
	
			`<code>${prefix}pipe 4Head | translate to:german | notify (user)</code>`,
			"Fetches a random joke, translates it to German, and reminds the target user with the text.",
			""		
		];
	})
};