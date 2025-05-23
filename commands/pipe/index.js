import config from "../../config.json" with { type: "json" };
const bannedCommandCombinations = config.modules.commands.bannedCombinations ?? [];

// matches | and > characters if and only if they're not preceded, nor followed by another | or >.
const PIPE_REGEX = /(?<![|>])[|>](?![|>])/;
const NESTED_PIPE_LIMIT = 10;
const RESULT_CHARACTER_LIMIT = 50_000;
const ERROR_REASONS = {
	block: "That user has blocked you from this command!",
	cooldown: "Still on cooldown!",
	filter: "You can't use this command here!",
	"no-command": "Not a command!",
	"opt-out": "That user has opted out from this command!",
	pending: "Another command still being executed!",
	"pipe-nsfw": "You cannot pipe NSFW results!"
};

export default {
	Name: "pipe",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Pipes the result of one command to another, and so forth. Each command will be used as if used separately, so each will be checked for cooldowns and banphrases. Use the character \"|\" or \">\" to separate each command.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "_apos", type: "object" },
		{ name: "_char", type: "string" },
		{ name: "_force", type: "boolean" },
		{ name: "_pos", type: "number" }
	],
	Whitelist_Response: null,
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
				splitter = PIPE_REGEX;
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
		const usedCommandNames = [];
		const { prefix } = sb.Command;

		for (let i = 0; i < invocations.length; i++) {
			const [commandString, ...cmdArgs] = invocations[i].split(" ");
			const commandData = (commandString.startsWith(prefix) && commandString.length > prefix.length)
				? sb.Command.get(commandString.slice(prefix.length))
				: sb.Command.get(commandString);

			if (!commandData) {
				return {
					success: false,
					reply: `Command "${commandString}" does not exist!`
				};
			}
			else if (!commandData.Flags.includes("pipe") && invocations[i + 1]) {
				return {
					success: false,
					reply: `Output of command "${commandString}" cannot be piped!`
				};
			}
			else if (nullCommand && commandData.Flags.includes("nonNullable") && invocations[i + 1]) {
				const [nextCommandString] = invocations[i + 1].split(" ");
				const nextCommand = sb.Command.get(nextCommandString.replace(sb.Command.prefixRegex, ""));
				if (nextCommand && nextCommand.Name === nullCommand.Name) {
					return {
						success: false,
						reply: `The output of command "${commandString}" cannot be directly piped into null!`
					};
				}
			}
			else if (commandData.Flags.includes("externalInput")) {
				hasExternalInput = true;
			}

			usedCommandNames.push(commandData.Name);

			const { aliasTry } = context.append;
			if (commandData.Name === "alias" && aliasTry?.userName && (cmdArgs[0] === "run" || commandString === "$")) {
				if (cmdArgs[0] === "run") {
					cmdArgs.splice(0, 1);
				}

				invocations[i] = ["alias", "try", aliasTry.userName, ...cmdArgs].join(" ");
			}
		}

		let totalUsedCommandNames;
		if (context.append.commandList) {
			totalUsedCommandNames = context.append.commandList;

			const pipeIndex = totalUsedCommandNames.indexOf("pipe");
			if (pipeIndex !== -1) {
				totalUsedCommandNames.splice(pipeIndex, 1, ...usedCommandNames);
			}
			else {
				totalUsedCommandNames.push(...usedCommandNames);
			}
		}
		else {
			totalUsedCommandNames = usedCommandNames;
		}

		for (const combination of bannedCommandCombinations) {
			let index = 0;
			for (const commandName of totalUsedCommandNames) {
				if (commandName === combination[index]) {
					index++;
				}

				if (!combination[index]) {
					return {
						success: false,
						reply: `Your pipe contains a combination of commands that is not allowed! Commands: ${combination.join(" → ")}`
					};
				}
			}
		}

		// let finalResult = null;
		let currentArgs = [];
		let privateMessageReply = false;
		let meActionReply = false;

		for (let i = 0; i < invocations.length; i++) {
			const inv = invocations[i];
			const [rawCmd, ...restArgs] = inv.split(" ");

			let argumentStartPosition = null;
			if (typeof context.params._apos?.[i] !== "undefined") {
				argumentStartPosition = Number(context.params._apos?.[i]);
			}
			else if (typeof context.params._pos !== "undefined") {
				argumentStartPosition = Number(context.params._pos);
			}

			if (argumentStartPosition !== null && !core.Utils.isValidInteger(argumentStartPosition)) {
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

			const pipeCount = (context.append.pipeCount ?? 0) + 1;
			if (pipeCount > NESTED_PIPE_LIMIT) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						Your pipe cannot continue!
						It causes more than ${NESTED_PIPE_LIMIT} pipe calls.
						Please reduce the complexity first.
					`
				};
			}

			const cmd = (rawCmd.startsWith(prefix) && rawCmd.length > prefix.length)
				? rawCmd.slice(prefix.length)
				: rawCmd;

			const execution = await sb.Command.checkAndExecute({
				command: cmd,
				args: cmdArgs,
				user: context.user,
				channel: context.channel,
				platform: context.platform,
				platformSpecificData: context.platformSpecificData,
				options: {
					...context.append,
					pipeCount,
					tee: context.tee,
					platform: context.platform,
					platformSpecificData: context.platformSpecificData,
					commandList: totalUsedCommandNames,
					pipe: true,
					pipeIndex: i,
					skipBanphrases: true,
					skipPending: true,
					skipMention: true,
					partialExecute: true
				}
			});

			if (execution) {
				if (typeof execution.replyWithPrivateMessage === "boolean") {
					privateMessageReply = execution.replyWithPrivateMessage;
				}
				else if (typeof execution.replyWithMeAction === "boolean") {
					meActionReply = execution.replyWithMeAction;
				}
			}

			if (!execution) { // Banphrase result: Do not reply
				currentArgs = [];
			}
			else if (execution.success === false) {
				if (context.params._force) {
					let reply = execution.reply;
					if (!reply) {
						reply = (execution.reason === "cooldown")
							? `Your pipe failed because the "${cmd}" command is currently on cooldown!`
							: "(no reply)";
					}

					const string = core.Utils.wrapString(reply, RESULT_CHARACTER_LIMIT, {
						keepWhitespace: true
					});

					currentArgs = string.split(" ");
				}
				else if (execution.reason === "cooldown") {
					if (i === 0) { // Short-circuit if the command is the last one in pipe
						return execution;
					}
					else {
						return {
							...execution,
							replyWithPrivateMessage: privateMessageReply,
							replyWithMeAction: meActionReply,
							reply: execution.reply ?? `Your pipe failed because the "${cmd}" command is currently on cooldown!`
						};
					}
				}
				else {
					const reply = ERROR_REASONS[execution.reason] ?? execution.reply ?? execution.reason;
					return {
						success: false,
						replyWithPrivateMessage: privateMessageReply,
						replyWithMeAction: meActionReply,
						reply: `Pipe command ${cmd} failed: ${reply}`
					};
				}
			}
			else if (!execution.reply && i < invocations.length - 1) { // Only applies to commands that aren't last in the sequence
				currentArgs = [];
			}
			else if (execution.reply === null && execution.success !== false) { // "Special" case for successful `null` results - pretend as if nothing happened
				return execution;
			}
			else if (typeof execution !== "object") { // Banphrase result: Reply with message
				return {
					reply: execution
				};
			}
			else if (execution.reason === "bad_invocation" && execution.reply) {
				return {
					success: false,
					reply: `Command "${cmd}" failed: ${execution.reply}`
				};
			}
			else if (execution.reason === "error" && execution.reply) {
				return {
					success: false,
					reply: execution.reply
				};
			}
			else {
				const string = core.Utils.wrapString(execution.reply, RESULT_CHARACTER_LIMIT, {
					keepWhitespace: true
				});

				currentArgs = string.split(" ");
			}

			// lastCommand = sb.Command.get(cmd.replace(sb.Command.prefix, ""));
			// finalResult = result;
		}

		return {
			cooldown: (context.append.pipe) ? null : this.Cooldown,
			hasExternalInput,
			// skipExternalPrefix: Boolean(lastCommand.Flags.includes("skipBanphrase")),
			replyWithPrivateMessage: privateMessageReply,
			replyWithMeAction: meActionReply,
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
