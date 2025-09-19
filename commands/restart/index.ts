import { promisify } from "node:util";
import { exec } from "node:child_process";
import { declare } from "../../classes/command.js";
const shell = promisify(exec);

import { getConfig } from "../../config.js";
const { basePath } = getConfig();

const restartMethods = {
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
} as const;
const isRestartMethod = (input: string): input is keyof typeof restartMethods => (
	Object.keys(restartMethods).includes(input)
);

export default declare({
	Name: "restart",
	Aliases: null,
	Cooldown: 10_000,
	Description: "Restarts the bot. Optionally, also pulls git changes and/or upgrades packages via yarn.",
	Flags: ["system", "whitelist"],
	Params: [],
	Whitelist_Response: "Only available to administrators or helpers!",
	Code: async function restart (context, ...commands) {
		for (const name of commands) {
			if (!isRestartMethod(name)) {
				return {
					success: false,
					reply: `Incorrect reload command provided! Use one of: ${Object.keys(restartMethods).join(", ")}`
				};
			}

			const reloadCommand = restartMethods[name];
			await context.sendIntermediateMessage(`VisLaud 👉 ${reloadCommand.message}`);

			for (const command of reloadCommand.commands) {
				await shell(command);
			}
		}

		await context.sendIntermediateMessage("Restarting...");

		// It is fully intended to exit the process here.
		// eslint-disable-next-line unicorn/no-process-exit
		setTimeout(() => process.exit(0), 1000);

		return {
			reply: null
		};
	},
	Dynamic_Description: () => [
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
});
