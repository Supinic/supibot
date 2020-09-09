module.exports = {
	Name: "spm",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T19:44:34.000Z",
	Cooldown: 0,
	Description: "Various utility subcommands related to supibot-package-manager.",
	Flags: ["developer","mention","whitelist"],
	Whitelist_Response: "Only Supi can use this command, but you can check the repository here: https://github.com/supinic/supibot-package-manager peepoHackies\n\t",
	Static_Data: ({
		exists: require("util").promisify(require("fs").exists)
	}),
	Code: (async function spm (context, ...args) {
		const operation = args.shift()?.toLowerCase();
		if (!operation) {
			throw new sb.Error({
				message: "No spm operation provided"
			});
		}
	
		const type = args.shift()?.toLowerCase();
		if (!type) {
			throw new sb.Error({
				message: "No operation type provided"
			});
		}
	
		if (operation === "dump") {
			const fs = require("fs").promises;
			switch (type) {
				case "commands": {
					let updated = 0;
					const promises = sb.Command.data.map(async (command) => {
						const dir = `/code/spm/commands/${command.Name}`;
						if (!await this.staticData.exists(dir)) {
							await fs.mkdir(dir);
						}
	
						let save = false;
						try {
							// Only allow the overwrite of an existing command when the database definition changed more recently than the file
							const stats = await fs.stat(`${dir}/index.js`);
							if (command.Last_Edit > stats.mtime) {
								save = true;
							}
						}
						catch (e) {
							if (e.message.includes("ENOENT")) {
								save = true;
							}
							else {
								throw e;
							}
						}
	
						if (save) {
							updated++;
							await command.serialize({
								overwrite: true,
								filePath: `${dir}/index.js`
							});
						}
					});
	
					await Promise.all(promises);
	
					const suffix = (updated === 1) ? "" : "s";				
					return {
						reply: (updated === 0)
							? `No changes detected, nothing was saved peepoNerdDank`
							: `Saved ${updated} command${suffix} into supibot-package-manager/commands peepoHackies`
					};
				}
	
				default:
					throw new sb.Error({
						message: "Unsupported dump operation"
					});
			}
	
		}
		else if (operation === "load") {
			throw new sb.Error({
				message: "Not implemented"
			});
		}
		else {
			throw new sb.Error({
				message: "Invalid operation"
			});
		}
	}),
	Dynamic_Description: null
};