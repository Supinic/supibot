INSERT INTO `chat_data`.`Command` 
(`Name`,`Aliases`,`Flags`,`Description`,`Cooldown`,`Code`,`Whitelist_Response`)
VALUES
('ping',NULL,NULL,'Pong!',5000,'(async function ping () {
	return {
		reply: "Pong!"
	};
})',NULL),
('debug',NULL,'system,whitelist','Debug command. Whitelisted by default, make sure to add a Filter object for yourself in order to be able to use this command.',0,'(async function debug (context, ...args) {
	const vm = require("vm");
	let script = null;	

	try {
		script = new vm.Script("(async () => {\\n" + args.join(" ") + "\\n})()");
	}
	catch (e) {
		return {
			reply: "Parse: " + e.toString()
		};
	}

	try {
		const scriptContext = vm.createContext({version: process.version, context, sb});
		const ForeignObject = vm.runInContext("Object", scriptContext);
		let result = await script.runInNewContext(scriptContext, { timeout: 2500 });
		if (typeof result !== "undefined") {
			if (result?.constructor === ForeignObject) {
				result = JSON.stringify(result, null, 4);
			}

			return {
				reply: String(result)
			};
		}
		else {
			return { 
				reply: "Done"
			};
		}
	}
	catch (e) {
		console.log(e);
		return { 
			reply: "Execute: " + e.toString()
		};
	}		
})','This command is whitelisted! Make sure to add a Filter object for yourself in order to be able to use this command.'),
('help','["commands"]',NULL,'Posts a description of a specific command, or a list of all commands.',5000,'(async function help (context, commandString) {
	const { prefix } = sb.Command;

	// No specified command - print all available commands in given channel for given user
	if (!commandString || context.invocation === "commands") {
		return {
			reply: sb.Command.data.map(i => `${prefix}${i.Name}`).join(", ")
		};
	}
	// Print specific command description
	else {
		const cmdStr = commandString.toLowerCase().replace(new RegExp("^\\\\" + prefix), "");
		if (cmdStr === "me") {
			return { reply: "I can\'t directly help you, but maybe if you use one of my commands, you\'ll feel better? :)" };
		}

		const command = sb.Command.data.find(cmd => cmd.Name.toLowerCase() === cmdStr || cmd.Aliases.includes(cmdStr));
		if (!command) {
			return { reply: "That command does not exist!" };
		}

		const filteredResponse = (command.Flags.whitelist)
			? "(whitelisted)"
			: "";
		const aliases = (command.Aliases.length === 0) ? "" : (" (" + command.Aliases.map(i => prefix + i).join(", ") + ")");
		const reply = [
			prefix + command.Name + aliases + ":",
			command.Description || "(no description)",
			"- " + sb.Utils.round(command.Cooldown / 1000, 1) + " seconds cooldown.",
			filteredResponse
		];

		return { reply: reply.join(" ") };
	}
})', NULL),
('reload',NULL,'pipe,skip-banphrase,system,whitelist','Reloads a database definition or hotloads an updated script',5000,'(async function reload (context, target, ...rest) {
    switch (target) {
        case "afks": await sb.AwayFromKeyboard.reloadData(); break;

        case "bans":
        case "filters": await sb.Filter.reloadData(); break;

        case "banphrases": await sb.Banphrase.reloadData(); break;

        case "channels": await sb.Channel.reloadData(); break;

        case "commands": await sb.Command.reloadData(); break;
        case "command": {
            try {
                await sb.Command.reloadSpecific(target, ...rest);
            }
            catch {
                return {
                    success: false,
                    reply: "No valid commands provided!"
                };
            }

            break;
        }

        case "config": await sb.Config.reloadData(); break;

        case "cron": await sb.Cron.reloadData(); break;

        case "extranews": await sb.ExtraNews.reloadData(); break;

        case "got": await sb.Got.reloadData(); break;

        case "reminders": await sb.Reminder.reloadData(); break;

        case "users": await sb.User.reloadData(); break;

        default: return { reply: "Unrecognized module!" };
    }

    return {
        reply: "Reloaded successfully."
    };
})', 'This command is whitelisted! Make sure to add a Filter object for yourself in order to be able to use this command.'),
('pipe',NULL,'mention,system','Pipes the result of one command to another, and so forth. Each command will be used as if used separately, so each will be checked for cooldowns and banphrases. Use the character "|" or ">" to separate each command.',5000,'(async function pipe (context, ...args) {
     const invocations = args.join(" ").split(/[|>]/).map(i => i.trim());
     if (!context.externalPipe && invocations.length < 2) {
         return { reply: "At least two commands must be piped together!" };
     }

     const resultsInPastebin = args[args.length - 1] === "pastebin";
     let finalResult = null;
     let fakeChannel = null;

     if (context.channel) {
         const tempData = {...context.channel};
         tempData.Data = JSON.stringify(tempData.Data);

         fakeChannel = new sb.Channel(tempData);
         fakeChannel.Mention = false;
     }

     let currentArgs = [];

     for (const inv of invocations) {
         let [cmd, ...cmdArgs] = inv.replace(/^\$\s*/, "$").split(" ");
         cmdArgs = cmdArgs.concat(currentArgs);

         if (cmd.includes("translate")) {
             cmdArgs.push("direction:false", "confidence:false");
         }
         else if (cmd.includes("rg")) {
             cmdArgs.push("linkOnly:true");
         }

         const check = sb.Command.get(cmd.replace(sb.Command.prefix, ""));
         if (check) {
             if (!check.Flags.pipe) {
                 return { reply: "Command " + cmd + " cannot be used in a pipe!" };
             }
         }

         const result = await sb.Command.checkAndExecute(
             cmd,
             cmdArgs,
             fakeChannel,
             context.user,
             {
                 ...context.append,
                 platform: context.platform,
                 pipe: true,
                 skipPending: true,
                 skipBanphrases: true
             }
         );

         console.debug("Pipe", result);

         if (!result) { // Banphrase result: Do not reply
             return { reply: null };
         }
         else if (typeof result !== "object") { // Banphrase result: Reply with message
             return { reply: result };
         }
         else if (result.reason === "bad_invocation" && result.reply) {
             return { reply: `Command "${cmd}" failed: ${result.reply}` };
         }
         else if (result.reason === "error" && result.reply) {
             return { reply: result.reply };
         }
         else if (result.success === false) { // Command result: Failed (cooldown, no command, ...)
             let reply = "";
             switch (result.reason) {
                 case "no-command": reply = "Not a command!"; break;
                 case "pending": reply = "Another command still being executed!"; break;
                 case "cooldown": reply = "Still on cooldown!"; break;
                 case "filter": reply = "You can\'t use this command here!"; break;
                 case "block": reply = "That user has blocked you from this command!"; break;
                 case "opt-out": reply = "That user has opted out from this command!"; break;
                 case "pipe-nsfw": reply = "You cannot pipe NSFW results!"; break;

                 default: reply = result.reson ?? result.reply;
             }

             return {
                 reply: `Pipe will not continue, because command ${cmd} failed: ${reply}`
             };
         }
         else if (!result.reply) { // Command result: Failed (ban)
             return { reply: "The final result of pipe is banphrased." };
         }
         else if (resultsInPastebin) {
             currentArgs = result.reply.split(" ");
         }
         else {
             currentArgs = sb.Utils.wrapString(result.reply, 300).split(" ");
         }

         finalResult = result;
     }

     return {
         replyWithPrivateMessage: Boolean(finalResult.replyWithPrivateMessage),
         reply: currentArgs.join(" ")
     };
})', NULL)

ON DUPLICATE KEY UPDATE ID = ID;