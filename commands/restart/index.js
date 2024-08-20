const { promisify } = require("node:util");
const shell = promisify(require("node:child_process").exec);

let config;
try {
	config = require("../../config.json");
}
catch {
	console.warn(`Custom config not found, $restart command will use base path "${__dirname}"`);
	config = { basePath: __dirname };
}

const { basePath } = config;
const methods = {
	prodUpdate: {
		message: "yarn prod-update",
		commands: ["yarn prod-update"]
	},
	pull: {
		message: "git pull",
		commands: [
			`git -C ${basePath} checkout -- yarn.lock package.json`,
			`git -C ${basePath} pull origin master`
		]
	}
};
const methodNames = ["all", ...Object.keys(methods)];

module.exports = {
	Name: "restart",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10_000,
	Description: "Restarts the bot. Optionally, also pulls git changes and/or upgrades packages via yarn.",
	Flags: ["system"],
	Params: null,
	Whitelist_Response: "Only available to administrators or helpers!",
	Code: async function restart (context, reloadCommand) {
		if (reloadCommand && !methodNames.includes(reloadCommand)) {
			return {
				success: false,
				reply: `Invalid command provided! Use one of: ${methodNames.join(", ")}`
			};
		}

		const commandsToRun = [];
		if (reloadCommand === "all") {
			commandsToRun.push(...methodNames);
		}
		else if (reloadCommand) {
			commandsToRun.push(reloadCommand);
		}

		for (const reloadCommand of commandsToRun) {
			await context.sendIntermediateMessage(`VisLaud 👉 ${reloadCommand.message}`);

			for (const command of reloadCommand.commands) {
				await shell(command);
			}
		}

		await context.sendIntermediateMessage("Restarting...");
		setTimeout(() => process.exit(0), 1000);

		return null;
	},
	Dynamic_Description: async () => [
		"Restarts the process of Supibot or the supinic.com website.",
		"Only usable by administrators and whitelisted users.",
		"",

		"<code>$restart</code>",
		"Restarts Supibot via process.exit()",
		"",

		"<code>$restart pull</code>",
		"Runs <code>git pull</code> first, then exits the process.",
		"",

		"<code>$restart bot upgrade</code>",
		"Runs <code>yarn prod-update</code> first, then exits the process.",
		"",

		"<code>$restart bot all</code>",
		"<code>$restart web all</code>",
		"Combination of pull and upgrade."
	]
};
