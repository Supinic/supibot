module.exports = {
	Name: "spm",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Various utility subcommands related to supibot-package-manager.",
	Flags: ["developer","mention","whitelist"],
	Whitelist_Response: "Only Supi can use this command, but you can check the repository here: https://github.com/supinic/supibot-package-manager peepoHackies",
	Static_Data: (() => ({
		exists: require("util").promisify(require("fs").exists),
		operations: ["dump", "load"],
		helpers: {},
		commands: [
			{
				name: "command",
				aliases: ["commands"],
				dump: async (context, fs, shell, ...args) => {
					const now = new sb.Date();
					const updated = [];
					const commands = (args.length > 0)
						? args.map(i => sb.Command.get(i)).filter(Boolean)
						: sb.Command.data;

					if (commands.length === 0) {
						return {
							success: false,
							reply: "No valid commands provided!"
						};
					}

					const promises = commands.map(async (command) => {
						const dir = `/code/spm/commands/${command.Name}`;
						if (!await this.staticData.exists(dir)) {
							await fs.mkdir(dir);
						}

						let row = await sb.Query.getRow("chat_data", "Command");
						let save = false;

						try {
							await row.load(command.ID);

							// Only allow the overwrite of an existing command when
							// the database definition changed more recently than the file
							const [stats] = await fs.stat(`${dir}/index.js`);

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
				},
				load: async (context, fs, shell, ...args) => {
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

					// If the spm command is tasked with reloading itself, don't call reloadSpecific immediately,
					// as this destroys the command before it finishes executing.
					if (updated.includes("spm")) {
						setTimeout(async () => {
							await sb.Command.reloadSpecific("spm");
							await context.channel.send("spm command reloaded peepoHackies");
						}, 2500);

						await context.channel.send(`The spm command was tasked to reload itself! monkaStare I will reload it in 2.5 seconds instead of right now.`);
						updated.splice(updated.indexOf("spm"), 1);
					}

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
			},
			{
				name: "chat-module",
				aliases: ["chatmodule", "chatmodules", "chat-modules"],
				dump: async (context, fs, shell, ...args) => {
					const now = new sb.Date();
					const updated = [];
					const modules = (args.length > 0)
						? args.map(i => sb.ChatModule.get(i)).filter(Boolean)
						: sb.ChatModule.data;

					if (modules.length === 0) {
						return {
							success: false,
							reply: "No valid chat modules provided!"
						};
					}

					const promises = modules.map(async (module) => {
						const dir = `/code/spm/chat-modules/${module.Name}`;
						if (!await this.staticData.exists(dir)) {
							await fs.mkdir(dir);
						}

						let row = await sb.Query.getRow("chat_data", "Chat_Module");
						let save = false;

						try {
							await row.load(module.ID);
							const stats = await fs.stat(`${dir}/index.js`);

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
							updated.push(module.Name);
							row.values.Last_Edit = now;

							await Promise.all([
								row.save(),
								module.serialize({
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
							: `Saved ${updated.length} chat-module${suffix} into spm/chat-modules peepoHackies`
					};
				},
				load: async (context, fs, shell, ...args) => {
					const updated = [];
					const moduleDirs = (args.length > 0)
						? args.map(i => sb.ChatModule.get(i)?.Name ?? i)
						: await fs.readdir("/code/spm/chat-modules");

					const promises = moduleDirs.map(async (chatModule) => {
						const chatModuleFile = `/code/spm/chat-modules/${chatModule}/index.js`;
						if (!await this.staticData.exists(chatModuleFile)) {
							console.warn(`index.js file for chat module ${chatModule} does not exist!`);
							return;
						}

						// Fetch the latest commit for a given file
						const commitHash = (await shell(sb.Utils.tag.trim `
							git
							-C /code/spm
							log -n 1
							--pretty=format:%H
							-- chat-modules/${chatModule}/index.js
						`)).stdout;

						// Chat module file has no git history, skip
						if (!commitHash) {
							console.log(`Chat module ${chatModule}: no Git history`);
							return;
						}

						const currentModule = sb.ChatModule.get(chatModule);
						if (!currentModule) { // New chat module - save
							console.warn("New chat module detected - functionality not yet implemented");
							return;
						}

						const row = await sb.Query.getRow("chat_data", "ChatModule");
						await row.load(currentModule.ID);
						if (row.values.Latest_Commit === commitHash) {
							console.log(`Chat module ${chatModule}: no change`);
							return;
						}

						delete require.cache[require.resolve(chatModuleFile)];
						const definition = require(chatModuleFile);

						const jsonify = ["Events"];
						const functionStringify = ["Code"];
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
						updated.push(currentModule.Name);
					});

					await Promise.all(promises);

					if (updated.length > 0) {
						await sb.ChatModule.reloadData();
					}

					updated.sort();
					const suffix = (updated.length === 1) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, no chat modules were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} chat module${suffix} (${updated.join(", ")}) from spm/chat-modules peepoHackies`
					};
				}
			},
			{
				name: "cron",
				aliases: ["crons"],
				dump: async (context, fs, shell, ...args) => {
					const now = new sb.Date();
					const updated = [];
					const modules = (args.length > 0)
						? args.map(i => sb.Cron.get(i)).filter(Boolean)
						: sb.Cron.data;

					if (modules.length === 0) {
						return {
							success: false,
							reply: "No valid crons provided!"
						};
					}

					const promises = modules.map(async (module) => {
						const dir = `/code/spm/crons/${module.Name}`;
						if (!await this.staticData.exists(dir)) {
							await fs.mkdir(dir);
						}

						let row = await sb.Query.getRow("chat_data", "Cron");
						let save = false;

						try {
							await row.load(module.ID);
							const stats = await fs.stat(`${dir}/index.js`);

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
							updated.push(module.Name);
							row.values.Last_Edit = now;

							await Promise.all([
								row.save(),
								module.serialize({
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
							: `Saved ${updated.length} chat-module${suffix} into spm/chat-modules peepoHackies`
					};
				},
				load: async (context, fs, shell, ...args) => {
					const updated = [];
					const cronDirs = (args.length > 0)
						? args.map(i => sb.Cron.get(i)?.Name ?? i)
						: await fs.readdir("/code/spm/crons");

					const promises = cronDirs.map(async (cron) => {
						const cronFile = `/code/spm/crons/${cron}/index.js`;
						if (!await this.staticData.exists(cronFile)) {
							console.warn(`index.js file for cron ${cron} does not exist!`);
							return;
						}

						// Fetch the latest commit for a given file
						const commitHash = (await shell(sb.Utils.tag.trim `
							git
							-C /code/spm
							log -n 1
							--pretty=format:%H
							-- crons/${cron}/index.js
						`)).stdout;

						// Cron file has no git history, skip
						if (!commitHash)   {
							console.log(`Crons ${cron}: no Git history`);
							return;
						}

						const currentCron = sb.Cron.get(cron);
						if (!currentCron) { // New cron - save
							console.warn("New cron detected - functionality not yet implemented");
							return;
						}

						const row = await sb.Query.getRow("chat_data", "Cron");
						await row.load(currentCron.ID);
						if (row.values.Latest_Commit === commitHash) {
							console.log(`Cron ${cron}: no change`);
							return;
						}

						delete require.cache[require.resolve(cronFile)];
						const definition = require(cronFile);

						const jsonify = ["Defer"];
						const functionStringify = ["Code"];
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
						updated.push(currentCron.Name);
					});

					await Promise.all(promises);

					if (updated.length > 0) {
						await sb.ChatModule.reloadData();
					}

					updated.sort();
					const suffix = (updated.length === 1) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, no chat modules were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} chat module${suffix} (${updated.join(", ")}) from spm/chat-modules peepoHackies`
					};
				}
			}
		]
	})),
	Code: (async function spm (context, ...args) {
		const operation = args.shift()?.toLowerCase();
		if (!operation) {
			return {
				success: false,
				reply: "No spm operation provided"
			};
		}
		else if (!this.staticData.operations.includes(operation)) {
			return {
				success: false,
				reply: "Invalid spm operation provided"
			};
		}
	
		const type = args.shift()?.toLowerCase();
		const definition = this.staticData.commands.find(i => i.name === type || i.aliases.includes(type));
		if (!type) {
			return {
				success: false,
				reply: "Invalid operation target provided"
			};
		}
		else if (!definition[operation]) {
			return {
				success: false,
				reply: `spm ${type} does not have functionality for the "${operation}" operation`
			};
		}
	
		const fs = require("fs").promises;
		const shell = require("util").promisify(require("child_process").exec);
		if (operation === "load") {
			try {
				const result = await shell("git -C /code/spm pull origin master");
				await context.channel.send(`git pull PepoG ${result.stdout}`);
			}
			catch (e) {
				console.error("git pull error", e);
				return {
					success: false,
					reply: `git pull failed monkaStare error is in console`
				};
			}
		}

		return await definition[operation](context, fs, shell, ...args);
	}),
	Dynamic_Description: null
};