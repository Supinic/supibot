module.exports = {
	Name: "restart",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Restarts the bot/website process via pm2, optionally also git-pulls changes and/or upgrades the supi-core module.",
	Flags: ["read-only","system","whitelist"],
	Params: null,
	Whitelist_Response: "Only available to administrators!",
	Static_Data: (() => ({
		dir: {
			bot: "/code/supibot",
			web: "/code/web"
		},
		pm2: {
			bot: "pm2 restart supibot",
			web: "sudo pm2 restart web"
		}
	})),
	Code: (async function restart (context, ...types) {
		const { promisify } = require("util");
		const shell = promisify(require("child_process").exec);
		const processType = (types.includes("web") || types.includes("site") || types.includes("website"))
			? "web"
			: "bot";
	
		types = types.map(i => i.toLowerCase());
	
		const queue = [];
		const dir = this.staticData.dir[processType];
		const pm2 = this.staticData.pm2[processType];
		const respond = (context.channel)
			? (string) => context.channel.send(string)
			: (string) => context.platform.pm(string, context.user.Name);
	
		if (types.includes("all") || types.includes("pull")) {
			queue.push(async () => {
				await respond("VisLaud 👉 git pull origin master");
	
				await shell(`git -C ${dir} checkout -- yarn.lock package.json`);
				const result = await shell(`git -C ${dir} pull origin master`);
				console.log("pull result", { stdout: result.stdout, stderr: result.stderr });
			});
		}
		if (types.includes("all") || types.includes("yarn") || types.includes("upgrade")) {
			queue.push(async () => {
				await respond("VisLaud 👉 yarn upgrade supi-core");
	
				const result = await shell(`yarn --cwd ${dir} upgrade supi-core`);
				console.log("upgrade result", { stdout: result.stdout, stderr: result.stderr });
			});
		}
	
		queue.push(async () => {
			await respond("VisLaud 👉 Restarting process");
			setTimeout(() => shell(pm2), 1000);
		});
	
		for (const fn of queue) {
			await fn();
		}
	
		return null;
	}),
	Dynamic_Description: null
};