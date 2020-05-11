INSERT INTO `chat_data`.`Command` 
(`Name`,`Aliases`,`Flags`,`Description`,`Cooldown`,`Code`)
VALUES
('ping',NULL,NULL,'Ping!',5000,'(async function () {
	return {
		reply: "Pong!"
	};
})'),
('debug',NULL,'system,whitelist','Debug command. Whitelisted by default, make sure to add a Filter object for yourself in order to be able to use this command.',0,'(async function debug (context, ...args) {
	const vm = require("vm");
	let script = null;	

	try {
		script = new vm.Script("(async () => {\n" + args.join(" ") + "\n})()");
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
})'),
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
		const cmdStr = commandString.toLowerCase().replace(new RegExp("^\\" + prefix), "");
		if (cmdStr === "me") {
			return { reply: "I can\'t directly help you, but maybe if you use one of my commands, you\'ll feel better? :)" };
		}

		const command = sb.Command.data.find(cmd => cmd.Name.toLowerCase() === cmdStr || cmd.Aliases.includes(cmdStr));
		if (!command) {
			return { reply: "That command does not exist!" };
		}

		const filteredResponse = (command.Flags?.includes("whitelist"))
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
})')

ON DUPLICATE KEY UPDATE ID = ID;