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

export default {
	Name: "restart",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10_000,
	Description: "Restarts the bot. Optionally, also pulls git changes and/or upgrades packages via yarn.",
	Flags: ["system", "whitelist"],
	Params: null,
	Whitelist_Response: "Only available to administrators or helpers!",
	Code: async function restart (context, ...commands) {
		for (const name of commands) {
			const reloadCommand = methods[name];
			if (!reloadCommand) {
				return {
					success: false,
					reply: `Incorrect reload command provided! Use one of: ${Object.keys(methods).join(", ")}`
				};
			}

			await context.sendIntermediateMessage(`VisLaud 👉 ${reloadCommand.message}`);

			for (const command of reloadCommand.commands) {
				await shell(command);
			}
		}

		await context.sendIntermediateMessage("Restarting...");
		// eslint-disable-next-line unicorn/no-process-exit
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
