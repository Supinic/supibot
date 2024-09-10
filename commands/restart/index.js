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
	pull: {
		message: "git pull",
		commands: [
			`git -C ${basePath} checkout -- yarn.lock package.json`,
			`git -C ${basePath} pull origin master`
		]
	},
	prodUpdate: {
		message: "yarn prod-update",
		commands: ["yarn prod-update"]
	},
	build: {
		message: "yarn build",
		commands: ["yarn build"]
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

		for (const name of commandsToRun) {
			const reloadCommand = methods[name];
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
		"The subcommands, except for \"all\" can be combined between each other",
		"",

		"<code>$restart</code>",
		"Restarts Supibot via process.exit()",
		"",

		"<code>$restart pull</code>",
		"Runs <code>git pull</code>, then exits the process.",
		"",

		"<code>$restart bot prodUpdate</code>",
		"Runs <code>yarn prod-update</code>, then exits the process.",
		"",

		"<code>$restart bot build</code>",
		"Runs <code>yarn build</code>, then exits the process.",
		"",

		"<code>$restart bot all</code>",
		"Combination of all commands in this order: pull, prod-update, build, exit."
	]
};
