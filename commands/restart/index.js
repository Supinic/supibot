const paths = {
	dir: {
		bot: "~/supibot",
		web: "~/website"
	},
	pm2: {
		bot: "pm2 restart supibot",
		web: "pm2 restart website"
	}
};

module.exports = {
	Name: "restart",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10_000,
	Description: "Restarts the bot/website process via pm2, optionally also git-pulls changes and/or upgrades the supi-core module.",
	Flags: ["system","whitelist"],
	Params: null,
	Whitelist_Response: "Only available to administrators or helpers!",
	Static_Data: null,
	Code: async function restart (context, ...types) {
		const { promisify } = require("util");
		const shell = promisify(require("child_process").exec);
		const processType = (types.includes("web") || types.includes("site") || types.includes("website"))
			? "web"
			: "bot";

		types = types.map(i => i.toLowerCase());

		const queue = [];
		const dir = paths.dir[processType];
		const pm2 = paths.pm2[processType];

		if (processType === "bot" && types.includes("all")) {
			await context.sendIntermediateMessage("VisLaud 👉 yarn prod-update");
			const result = await shell(`yarn prod-update`);
			console.log("prod-update result", { stdout: result.stdout, stderr: result.stderr });
		}
		else {
			if (types.includes("all") || types.includes("pull") || types.includes("static")) {
				queue.push(async () => {
					await context.sendIntermediateMessage("VisLaud 👉 git pull origin master");

					await shell(`git -C ${dir} checkout -- yarn.lock package.json`);
					const result = await shell(`git -C ${dir} pull origin master`);
					console.log("pull result", { stdout: result.stdout, stderr: result.stderr });
				});
			}
			if (types.includes("all") || types.includes("yarn") || types.includes("upgrade")) {
				const { unlink } = require("fs/promises");
				queue.push(async () => {
					let message;
					try {
						await unlink("~/supibot/yarn.lock");
						message = "deleted yarn.lock";
					}
					catch {
						message = "didn't delete yarn.lock";
					}

					await context.sendIntermediateMessage(`VisLaud 👉 ${message} VisLaud 👉 yarn`);

					const result = await shell(`yarn --cwd ${dir} workspaces focus -A --production`);
					console.log("upgrade result", { stdout: result.stdout, stderr: result.stderr });
				});
			}
		}

		let resultMessage = `Process ${processType} restarted successfully.`;
		if (!types.includes("static")) {
			queue.push(async () => {
				await context.sendIntermediateMessage("VisLaud 👉 Restarting process");
				setTimeout(() => shell(pm2), 1000);
			});
		}
		else {
			resultMessage = `Process ${processType} successfully updated from Git. (no restart)`;
		}

		for (const fn of queue) {
			await fn();
		}

		if (processType === "bot") {
			return null;
		}
		else {
			return {
				reply: resultMessage
			};
		}
	},
	Dynamic_Description: async () => [
		"Restarts the process of Supibot or the supinic.com website.",
		"Only usable by administrators and whitelisted users.",
		"",

		"<code>$restart</code>",
		"<code>$restart bot</code>",
		"Restarts Supibot via PM2 restart.",
		"",

		"<code>$restart web</code>",
		"Restarts the website process, in the same way as Supibot's.",
		"",

		"<code>$restart bot pull</code>",
		"<code>$restart web pull</code>",
		"Runs <code>git pull</code> first, then restarts the process.",
		"",

		"<code>$restart bot upgrade</code>",
		"<code>$restart web upgrade</code>",
		"Runs <code>yarn upgrade</code> first, then restarts the process.",
		"",

		"<code>$restart bot all</code>",
		"<code>$restart web all</code>",
		"Combination of pull and upgrade.",
		"",

		"<code>$restart bot static</code>",
		"<code>$restart web static</code>",
		"Runs <code>git pull</code>, but doesn't restart the process."
	]
};
