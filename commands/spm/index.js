module.exports = {
	Name: "spm",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Various utility subcommands related to supibot-package-manager.",
	Flags: ["developer","mention","whitelist"],
	Whitelist_Response: "Only Supi can use this command, but you can check the repository here: https://github.com/supinic/supibot-package-manager peepoHackies",
	Static_Data: (() => ({
		exists: require("util").promisify(require("fs").exists)
	})),
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
	
		const fs = require("fs").promises;
		const shell = require("util").promisify(require("child_process").exec);
	
		if (operation === "dump") {
			switch (type) {
				case "commands": {
					const now = new sb.Date();
					const updated = [];
					const promises = sb.Command.data.map(async (command) => {
						const dir = `/code/spm/commands/${command.Name}`;
						if (!await this.staticData.exists(dir)) {
							await fs.mkdir(dir);
						}
	
						let row = await sb.Query.getRow("chat_data", "Command");
						let save = false;
	
						try {
							// Only allow the overwrite of an existing command when
							// the database definition changed more recently than the file
							const [stats] = await Promise.all([
								fs.stat(`${dir}/index.js`),
								row.load(command.ID)
							]);
	
							if (row.values.Last_Edit > stats.mtime) {
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
							updated.push(command.Name);
							row.values.Last_Edit = now;
	
							await Promise.all([
								row.save(),
								command.serialize({
									overwrite: true,
									filePath: `${dir}/index.js`
								})
							]);
						}
					});
	
					await Promise.all(promises);
	
					updated.sort();
					const suffix = (updated.length === 0) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, nothing was saved peepoNerdDank 👆`
							: `Saved ${updated.length} command${suffix} into spm/commands peepoHackies`
					};
				}
	
				default:
					throw new sb.Error({
						message: "Unsupported dump operation"
					});
			}
		}
		else if (operation === "load") {
			switch (type) {
				case "command":
				case "commands": {
					const updated = [];
					const commandDirs = (args.length > 0)
						? args.map(i => sb.Command.get(i)?.Name ?? i)
						: await fs.readdir("/code/spm/commands");
	
					const promises = commandDirs.map(async (command) => {
						const commandFile = `/code/spm/commands/${command}/index.js`;
						if (!await this.staticData.exists(commandFile)) {
							console.warn(`index.js file for command ${command} does not exist!`);
							return;
						}
	
						// Fetch the latest commit for a given file
						const commitHash = (await shell(sb.Utils.tag.trim `
							git
							-C /code/spm
							log -n 1
							--pretty=format:%H
							-- commands/${command}/index.js
						`)).stdout;
	
						// Command file has no git history, skip
						if (!commitHash)   {
							console.log(`Command ${command}: no Git history`);
							return;
						}
	
						const currentCommand = sb.Command.get(command);
						if (!currentCommand) { // New command - save
							console.warn("New command detected - functionality not yet implemented");
							return;
						}
	
						const row = await sb.Query.getRow("chat_data", "Command");
						await row.load(currentCommand.ID);
						if (row.values.Latest_Commit === commitHash) {
							console.log(`Command ${command}: no change`);
							return;
						}
	
						delete require.cache[require.resolve(commandFile)];
						const definition = require(commandFile);
	
						const jsonify = ["Aliases"];
						const functionStringify = ["Static_Data", "Code", "Dynamic_Description"];
						for (const [key, value] of Object.entries(definition)) {
							if (value === null) {
								row.values[key] = null;
							}
							else if (jsonify.includes(key)) {
								row.values[key] = JSON.stringify(value);
							}
							else if (functionStringify.includes(key)) {
								const lines = `(${value})`.split("\n");
								for (let i = 0; i < lines.length; i++) {
									if (lines[i].startsWith("\t")) {
										lines[i] = lines[i].slice(1);
									}
								}
	
								row.values[key] = lines.join("\n");
							}
							else {
								row.values[key] = value;
							}
						}
	
						row.values.Latest_Commit = commitHash;
						await row.save();
						updated.push(currentCommand.Name);
					});
	
					await Promise.all(promises);
					if (updated.length > 0) {
						await sb.Command.reloadSpecific(...updated);
					}
	
					updated.sort();
					const suffix = (updated.length === 1) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, no commands were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} command${suffix} (${updated.join(", ")}) from spm/commands peepoHackies`
					};
				}
	
				default:
					throw new sb.Error({
						message: "Unsupported load operation"
					});
			}
		}
		else {
			throw new sb.Error({
				message: "Invalid operation"
			});
		}
	}),
	Dynamic_Description: null
};