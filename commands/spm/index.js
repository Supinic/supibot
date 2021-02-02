module.exports = {
	Name: "spm",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Various utility subcommands related to supibot-package-manager.",
	Flags: ["developer","mention","whitelist"],
	Params: null,
	Whitelist_Response: "Only Supi can use this command, but you can check the repository here: https://github.com/supinic/supibot-package-manager peepoHackies",
	Static_Data: (() => ({
		operations: ["dump", "load"],
		helpers: {
			fs: require("fs").promises,
			exists: require("util").promisify(require("fs").exists),
			shell: require("util").promisify(require("child_process").exec),
			save: (async (item, options) => {
				const fs = require("fs").promises;
				const dir = `/code/spm/${options.dir}/${item.Name}`;
				if (!await this.staticData.helpers.exists(dir)) {
					await fs.mkdir(dir);
				}
	
				let row = await sb.Query.getRow(options.database, options.table);
				let save = false;
				try {
					await row.load(item.ID);
	
					// Only allow the overwriting of an existing item when
					// the database definition changed more recently than the file
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
	
				let updated = false;
				if (save) {
					updated = true;
					row.values.Last_Edit = options.now ?? new sb.Date();
	
					await Promise.all([
						row.save(),
						item.serialize({
							overwrite: true,
							filePath: `${dir}/index.js`
						})
					]);
				}
	
				return { updated };
			}),
			load: (async (item, options) => {
				const itemFile = `/code/spm/${options.dir}/${item}/index.js`;
				if (!await this.staticData.helpers.exists(itemFile)) {
					console.warn(`index.js file for ${options.name} ${item} does not exist`);
					return;
				}
	
				// Fetch the latest commit for a given file
				const shellResult = await this.staticData.helpers.shell(sb.Utils.tag.trim `
					git
					-C /code/spm
					log -n 1
					--pretty=format:%H
					-- ${options.dir}/${item}/index.js
				`);
	
				// Command file has no git history, skip
				const commitHash = shellResult.stdout;
				if (!commitHash) {
					console.log(`No Git history for ${options.name} ${item}`);
					return { updated: false };
				}
	
				const liveItem = options.module.get(item);
				const row = await sb.Query.getRow(options.database, options.table);
				if (liveItem) {
					await row.load(liveItem.ID);
				}
	
				if (row.values.Latest_Commit === commitHash) {
					console.log(`No change for ${options.name} ${item}`);
					return { updated: false };
				}
	
				delete require.cache[require.resolve(itemFile)];
	
				const definition = require(itemFile);
				for (const [key, value] of Object.entries(definition)) {
					if (value === null) {
						row.values[key] = null;
					}
					else if (options.jsonify.includes(key)) {
						row.values[key] = JSON.stringify(value);
					}
					else if (options.functionify.includes(key)) {
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
	
				return {
					name: row.values.Name,
					updated: Boolean(liveItem),
					added: !Boolean(liveItem)
				};
			}),
			message: (async (context, message) => {
				if (context.channel) {
					await context.channel.send(message);
				}
				else if (context.platform) {
					await context.platform.pm(message, context.user);
				}
			})
		},
		commands: [
			{
				name: "command",
				aliases: ["commands"],
				dump: async (context, helpers, ...args) => {
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
						const result = await helpers.save(command, {
							dir: "commands",
							database: "chat_data",
							table: "Command",
							now
						});
	
						if (result.updated) {
							updated.push(command.Name);
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
				load: async (context, helpers, ...args) => {
					const updated = [];
					const added = [];
					const commandDirs = (args.length > 0)
						? args.map(i => sb.Command.get(i)?.Name ?? i)
						: await helpers.fs.readdir("/code/spm/commands");
	
					const promises = commandDirs.map(async (command) => {
						const result = await helpers.load(command, {
							dir: "commands",
							database: "chat_data",
							table: "Command",
							name: "command",
							module: sb.Command,
							jsonify: ["Aliases", "Params"],
							functionify: ["Static_Data", "Code", "Dynamic_Description"]
						});
	
						if (result.updated) {
							updated.push(result.name);
						}
						else if (result.added) {
							added.push(result.name);
						}
					});
	
					await Promise.all(promises);
	
					// If the spm command is tasked with reloading itself, don't call reloadSpecific immediately,
					// as this destroys the command before it finishes executing.
					if (updated.includes("spm")) {
						setTimeout(async () => {
							await sb.Command.reloadSpecific("spm");
							await helpers.message(context, "spm command reloaded peepoHackies");
						}, 2500);
	
						await helpers.message(
							context,
							`The spm command was tasked to reload itself! monkaS I will reload it in 2.5 seconds instead of right now.`
						);
	
						updated.splice(updated.indexOf("spm"), 1);
					}
	
					if (added.length > 0) {
						await sb.Command.reloadData();
					}
					else if (updated.length > 0) {
						await sb.Command.reloadSpecific(...updated);
					}
	
					return {
						reply: (updated.length === 0)
							? `No changes detected, no commands were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} and added ${added.length} commands from spm peepoHackies`
					};
				}
			},
			{
				name: "chat-module",
				aliases: ["chatmodule", "chatmodules", "chat-modules"],
				dump: async (context, helpers, ...args) => {
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
	
					const promises = modules.map(async (chatModule) => {
						const result = await helpers.save(chatModule, {
							dir: "chat-modules",
							database: "chat_data",
							table: "Chat_Module",
							now
						});
	
						if (result.updated) {
							updated.push(chatModule.Name);
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
				load: async (context, helpers, ...args) => {
					const updated = [];
					const added = [];
					const moduleDirs = (args.length > 0)
						? args.map(i => sb.ChatModule.get(i)?.Name ?? i)
						: await helpers.fs.readdir("/code/spm/chat-modules");
	
					const promises = moduleDirs.map(async (chatModule) => {
						const result = await helpers.load(chatModule, {
							dir: "chat-modules",
							database: "chat_data",
							table: "Chat_Module",
							name: "chat module",
							module: sb.ChatModule,
							jsonify: ["Events"],
							functionify: ["Code"]
						});
	
						if (result.updated) {
							updated.push(result.name);
						}
						else if (result.added) {
							added.push(result.name);
						}
					});
	
					await Promise.all(promises);
	
					if (added.length > 0 || updated.length > 0) {
						await sb.ChatModule.reloadData();
					}
	
					return {
						reply: (updated.length === 0)
							? `No changes detected, nothing was added or updated peepoNerdDank 👆`
							: `Loaded ${updated.length} and added ${added.length} chat modules from spm peepoHackies`
					};
				}
			},
			{
				name: "cron",
				aliases: ["crons"],
				dump: async (context, helpers, ...args) => {
					const now = new sb.Date();
					const updated = [];
					const crons = (args.length > 0)
						? args.map(i => sb.Cron.get(i)).filter(Boolean)
						: sb.Cron.data;
	
					if (crons.length === 0) {
						return {
							success: false,
							reply: "No valid crons provided!"
						};
					}
	
					const promises = crons.map(async (cron) => {
						const result = await helpers.save(cron, {
							dir: "crons",
							database: "chat_data",
							table: "Cron",
							now
						});
	
						if (result.updated) {
							updated.push(cron.Name);
						}
					});
	
					await Promise.all(promises);
	
					updated.sort();
					const suffix = (updated.length === 0) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, nothing was saved peepoNerdDank 👆`
							: `Saved ${updated.length} cron${suffix} into spm/crons peepoHackies`
					};
				},
				load: async (context, helpers, ...args) => {
					const updated = [];
					const added = [];
					const cronDirs = (args.length > 0)
						? args.map(i => sb.Cron.get(i)?.Name ?? i)
						: await helpers.fs.readdir("/code/spm/crons");
	
					const promises = cronDirs.map(async (cron) => {
						const result = await helpers.load(cron, {
							dir: "crons",
							database: "chat_data",
							table: "Cron",
							name: "cron",
							module: sb.Cron,
							jsonify: [],
							functionify: ["Code", "Defer"]
						});
	
						if (result.updated) {
							updated.push(result.name);
						}
						else if (result.added) {
							added.push(result.name);
						}
					});
	
					await Promise.all(promises);
	
					if (added.length > 0 || updated.length > 0) {
						await sb.Cron.reloadData();
					}
	
					return {
						reply: (updated.length === 0)
							? `No changes detected, no crons were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} and added ${added.length} crons from spm peepoHackies`
					};
				}
			},
			{
				name: "got",
				aliases: ["gots", "got-instance"],
				dump: async (context, helpers, ...args) => {
					const now = new sb.Date();
					const updated = [];
					const crons = (args.length > 0)
						? args.map(i => sb.Cron.get(i)).filter(Boolean)
						: sb.Cron.data;
	
					if (crons.length === 0) {
						return {
							success: false,
							reply: "No valid crons provided!"
						};
					}
	
					const promises = crons.map(async (cron) => {
						const result = await helpers.save(cron, {
							dir: "crons",
							database: "chat_data",
							table: "Cron",
							now
						});
	
						if (result.updated) {
							updated.push(cron.Name);
						}
					});
	
					await Promise.all(promises);
	
					updated.sort();
					const suffix = (updated.length === 0) ? "" : "s";
					return {
						reply: (updated.length === 0)
							? `No changes detected, nothing was saved peepoNerdDank 👆`
							: `Saved ${updated.length} cron${suffix} into spm/crons peepoHackies`
					};
				},
				load: async (context, helpers, ...args) => {
					const updated = [];
					const added = [];
					const cronDirs = (args.length > 0)
						? args.map(i => sb.Cron.get(i)?.Name ?? i)
						: await helpers.fs.readdir("/code/spm/crons");
	
					const promises = cronDirs.map(async (cron) => {
						const result = await helpers.load(cron, {
							dir: "crons",
							database: "chat_data",
							table: "Cron",
							name: "cron",
							module: sb.Cron,
							jsonify: [],
							functionify: ["Code", "Defer"]
						});
	
						if (result.updated) {
							updated.push(result.name);
						}
						else if (result.added) {
							added.push(result.name);
						}
					});
	
					await Promise.all(promises);
	
					if (added.length > 0 || updated.length > 0) {
						await sb.Cron.reloadData();
					}
	
					return {
						reply: (updated.length === 0)
							? `No changes detected, no crons were loaded peepoNerdDank 👆`
							: `Loaded ${updated.length} and added ${added.length} crons from spm peepoHackies`
					};
				}
			}
		]
	})),
	Code: (async function spm (context, ...args) {
		const { commands, helpers, operations } = this.staticData;
		const operation = args.shift()?.toLowerCase();
		if (!operation) {
			return {
				success: false,
				reply: "No spm operation provided"
			};
		}
		else if (!operations.includes(operation)) {
			return {
				success: false,
				reply: "Invalid spm operation provided"
			};
		}
	
		const type = args.shift()?.toLowerCase();
		const definition = commands.find(i => i.name === type || i.aliases.includes(type));
		if (!type) {
			return {
				success: false,
				reply: "Invalid operation target provided"
			};
		}
		else if (!definition?.[operation]) {
			return {
				success: false,
				reply: `spm ${type} does not have functionality for the "${operation}" operation`
			};
		}
	
		if (operation === "load") {
			try {
				const result = await helpers.shell("git -C /code/spm pull origin master");
				await helpers.message(context, `git pull PepoG ${result.stdout}`);
			}
			catch (e) {
				console.error("git pull error", e);
				return {
					success: false,
					reply: `git pull failed monkaStare error is in console`
				};
			}
		}
	
		return await definition[operation](context, helpers, ...args);
	}),
	Dynamic_Description: null
};