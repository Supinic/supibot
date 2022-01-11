module.exports = {
	Name: "pipe",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Pipes the result of one command to another, and so forth. Each command will be used as if used separately, so each will be checked for cooldowns and banphrases. Use the character \"|\" or \">\" to separate each command.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "_apos", type: "object" },
		{ name: "_char", type: "string" },
		{ name: "_force", type: "boolean" },
		{ name: "_pos", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		// matches | and > characters if and only if they're not preceded, nor followed by another | or >.
		pipeRegex: /(?<![|>])[|>](?![|>])/,
		resultCharacterLimit: 50_000,
		reasons: {
			block: "That user has blocked you from this command!",
			cooldown: "Still on cooldown!",
			filter: "You can't use this command here!",
			"no-command": "Not a command!",
			"opt-out": "That user has opted out from this command!",
			pending: "Another command still being executed!",
			"pipe-nsfw": "You cannot pipe NSFW results!"
		}
	})),
	Code: (async function pipe (context, ...args) {
		let splitter;
		if (context.params._char) {
			splitter = context.params._char;
		}
		else {
			const input = args.join(" ");
			const alonePipeCount = [...input.matchAll(/\s\|\s/g)].length;
			const aloneBracketCount = [...input.matchAll(/\s>\s/g)].length;

			if (alonePipeCount === 0 && aloneBracketCount === 0) {
				splitter = this.staticData.pipeRegex;
			}
			else if (aloneBracketCount > alonePipeCount) {
				splitter = /\s>\s/;
			}
			else {
				splitter = /\s\|\s/;
			}
		}

		const invocations = args.join(" ").split(splitter).map(i => i.trim());
		if (!context.externalPipe && invocations.length < 2) {
			return {
				success: false,
				reply: "At least two commands must be piped together!"
			};
		}

		let hasExternalInput = false;
		const nullCommand = sb.Command.get("null");
		for (let i = 0; i < invocations.length; i++) {
			const [commandString, ...cmdArgs] = invocations[i].split(" ");
			const commandData = sb.Command.get(commandString);

			if (!commandData) {
				return {
					success: false,
					reply: `Command "${commandString}" does not exist!`
				};
			}
			else if (!commandData.Flags.pipe && invocations[i + 1]) {
				return {
					success: false,
					reply: `Output of command "${commandString}" cannot be piped!`
				};
			}
			else if (nullCommand && commandData.Flags.nonNullable && invocations[i + 1]) {
				const [nextCommandString] = invocations[i + 1].split(" ");
				const nextCommand = sb.Command.get(nextCommandString.replace(sb.Command.prefixRegex, ""));
				if (nextCommand && nextCommand.Name === nullCommand.Name) {
					return {
						success: false,
						reply: `The output of command "${commandString}" cannot be directly piped into null!`
					};
				}
			}
			else if (commandData.Flags.externalInput) {
				hasExternalInput = true;
			}

			const { aliasTry } = context.append;
			if (commandData.Name === "alias" && cmdArgs[0] === "run" && aliasTry?.userName) {
				cmdArgs[0] = "try";
				cmdArgs.splice(1, 0, aliasTry.userName);

				invocations[i] = [commandString, ...cmdArgs].join(" ");
			}
		}

		let finalResult = null;
		let currentArgs = [];

		// let lastCommand;
		for (let i = 0; i < invocations.length; i++) {
			const inv = invocations[i];
			const [cmd, ...restArgs] = inv.split(" ");

			let argumentStartPosition = null;
			if (typeof context.params._apos?.[i] !== "undefined") {
				argumentStartPosition = Number(context.params._apos?.[i]);
			}
			else if (typeof context.params._pos !== "undefined") {
				argumentStartPosition = Number(context.params._pos);
			}

			if (argumentStartPosition !== null && !sb.Utils.isValidInteger(argumentStartPosition)) {
				return {
					success: false,
					reply: "Invalid argument position provided!"
				};
			}

			const cmdArgs = [...restArgs];
			if (argumentStartPosition === null) {
				cmdArgs.push(...currentArgs);
			}
			else {
				cmdArgs.splice(argumentStartPosition, 0, ...currentArgs);
			}

			const result = await sb.Command.checkAndExecute(
				cmd,
				cmdArgs,
				context.channel,
				context.user,
				{
					...context.append,
					tee: context.tee,
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
			else if (!result.reply) {
				if (i < invocations.length - 1) { // Only applies to commands that aren't last in the sequence
					currentArgs = [];
				}
				else if (i === 0) { // Short-circuit if the command is the last one in pipe
					return result;
				}
				else {
					return {
						...result,
						reply: `Your pipe failed because the "${cmd}" command is currently on cooldown!`
					};
				}
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
				if (context.params._force) {
					const reply = result.reply ?? "(no reply)";
					const string = sb.Utils.wrapString(reply, this.staticData.resultCharacterLimit, {
						keepWhitespace: true
					});

					currentArgs = string.split(" ");
				}
				else {
					const reply = this.staticData.reasons[result.reason] ?? result.reply ?? result.reason;
					return {
						success: false,
						reply: `Pipe command ${cmd} failed: ${reply}`
					};
				}
			}
			else {
				const string = sb.Utils.wrapString(result.reply, this.staticData.resultCharacterLimit, {
					keepWhitespace: true
				});

				currentArgs = string.split(" ");
			}

			// lastCommand = sb.Command.get(cmd.replace(sb.Command.prefix, ""));
			finalResult = result;
		}

		return {
			hasExternalInput,
			// skipExternalPrefix: Boolean(lastCommand.Flags.skipBanphrase),
			replyWithPrivateMessage: Boolean(finalResult?.replyWithPrivateMessage),
			reply: currentArgs.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Pipes multiple commands together, where each command's result will become the input of another.",
		"Separate the commands with <code>|</code> or <code>&gt;</code> characters.",
		"",

		`<code>${prefix}pipe news RU | translate</code>`,
		"Fetches russian news, and immediately translates them to English (by default).",
		"",

		`<code>${prefix}pipe 4Head | translate to:german | notify (user)</code>`,
		"Fetches a random joke, translates it to German, and reminds the target user with the text.",
		"",

		"<h5>Advanced pipe parameters</h5>",
		"",

		`<code>${prefix}pipe _char:(text) (...)</code>`,
		`<code>${prefix}pipe _char:<u>FOO</u> rw 10 <u>FOO</u> translate to:de <u>FOO</u> tt fancy</code>`,
		"When the <code>_char</code> parameter is used, the commands will be separated by a character/text of your choosing",
		"",

		`<code>${prefix}pipe _apos:(index) (...)</code>`,
		"When the <code>_apos</code> parameter is used, every command in the pipe will have its result added to that index.",
		"",

		"Example 1:",
		"<code>$pipe _pos:2 shuffle a b c | tt fancy 1 2 3</code> => <code>1 2 𝓫 𝓪 𝓬 3</code>",
		"the <code>a, b, c</code> parameters are added to <code>tt fancy</code> at position 2, so it becomes <code>tt fancy 1 a b c 2 3</code>",
		"",

		"Example 2:",
		"<code>$pipe _apos:0=2 _apos:1=3 shuffle a b c | tt fancy A B C | tt fancy 1 2 3</code> => <code>1 2 3 𝓐 𝓑 𝓬 𝓪 𝓫 𝓒 </code>",
		"Similar to <code>_pos</code>, but _apos specifies the start position for each command.",
		" <code>_apos:0=3</code> => Command #0 uses start position 3.",
		"Reverts to the end of the command if invalid value is provided.",
		"",

		`<code>${prefix}pipe _force:true translate to:made-up-language foobar | remind (user)</code>`,
		"If used with <code>_force:true</code>, this invocation will actually pipe the failure response of the <code>translate</code> command into <code>remind</code>.",
		""
	])
};
