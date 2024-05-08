let config;
try {
	config = require("../../config.json");
}
catch {
	console.warn(`Custom config not found, $reload command will use base path "${__dirname}"`);
	config = { basePath: __dirname };
}

const BASE_PATH = config.basePath;

module.exports = {
	Name: "reload",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Reloads a database definition or hotloads an updated script",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: [
		{ name: "skipUpgrade", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		const shell = require("node:util").promisify(require("node:child_process").exec);
		const upgrade = async (context, module, name, reloadAll, ...list) => {
			if (!reloadAll && list.length === 0) {
				return {
					success: false,
					reply: `No ${name} names provided!`
				};
			}

			if (context.params.skipUpgrade !== true) {
				const emote = await context.getBestAvailableEmote(["ppCircle", "supiniLoading"], "⏳");
				const message = `${emote} running git pull, please wait ${emote}`;
				await context.sendIntermediateMessage(message);

				await shell(`git pull origin master`);
			}

			if (reloadAll) {
				try {
					await module.reloadData();
				}
				catch (e) {
					await sb.Logger.log("Command.Warning", JSON.stringify(e));
					return {
						success: false,
						reply: `An error occurred while reloading all ${name}s!`
					};
				}

				return {
					reply: `Reloaded all ${name}s successfully.`
				};
			}
			else {
				let result = {};
				if (module.importable) {
					const definitions = [];
					result.failed = [];

					for (const rawInstanceName of list) {
						const instance = module.get(rawInstanceName);
						const instanceName = (instance)
							? instance[module.uniqueIdentifier]
							: rawInstanceName;

						if (typeof module.invalidateRequireCache === "function") {
							module.invalidateRequireCache(`${BASE_PATH}/${name}`, instanceName);
						}

						const path = `${BASE_PATH}/${name}/${instanceName}`;
						try {
							if (name === "commands") {
								definitions.push(require(path));
							}
							else {
								const { definition } = await import(`${path}/index.mjs`);
								definitions.push(definition);
							}
						}
						catch (e) {
							result.failed.push({ e, instanceName });
						}
					}

					await module.importSpecific(...definitions);
				}
				else {
					result = await module.reloadSpecific(...list);
				}

				const moduleName = (name.endsWith("s"))
					? `${name.slice(0, -1)}(s)`
					: `${name}(s)`;

				if (result.failed.length === 0) {
					return {
						reply: `${list.length} ${moduleName} reloaded successfully.`
					};
				}
				else if (result.failed.length < list.length) {
					return {
						success: false,
						reply: `${list.length - result.failed.length} ${moduleName} reloaded successfully, but ${result.failed.length} failed!`
					};
				}
				else {
					return {
						success: false,
						reply: `All ${list.length} ${moduleName} failed to reload!`
					};
				}
			}
		};

		return {
			upgrade,

			types: [
				{
					target: "AwayFromKeyboard",
					names: ["afk", "afks"]
				},
				{
					target: "Banphrase",
					names: ["banphrase", "banphrases"]
				},
				{
					target: "Channel",
					names: ["channel", "channels"]
				},
				{
					executionType: "upgrade",
					target: "ChatModule",
					name: "chat module",
					dir: "chat-modules",
					names: ["chatmodule", "chatmodules", "chat-module", "chat-modules"],
					singular: ["chatmodule", "chat-module"],
					plural: ["chatmodules", "chat-modules"]
				},
				{
					executionType: "upgrade",
					target: "Command",
					name: "command",
					dir: "commands",
					names: ["command", "commands"],
					singular: ["command"],
					plural: ["commands"]
				},
				{
					target: "Config",
					names: ["config", "configs"]
				},
				{
					target: "Filter",
					names: ["filter", "filters"]
				},
				{
					executionType: "upgrade",
					target: "Got",
					name: "got instance",
					names: ["got", "gots"],
					dir: "gots",
					singular: ["got"],
					plural: ["gots"]
				},
				{
					target: "Reminder",
					names: ["reminder", "reminders"]
				},
				{
					target: "User",
					names: ["user", "users"],
					execution: async (context, invocation, ...names) => {
						if (invocation === "user") {
							await Promise.all(names.map(name => sb.User.invalidateUserCache(name)));
							await sb.User.getMultiple(names);

							return {
								reply: `${names.length} user(s) reloaded successfully.`
							};
						}
						else {
							await sb.User.reloadData();
							return {
								reply: `All users reloaded successfully.`
							};
						}
					}
				}
			]
		};
	}),
	Code: (async function reload (context, command, ...rest) {
		const { types, upgrade } = this.staticData;
		const item = types.find(i => i.names.includes(command));
		if (!item) {
			return {
				success: false,
				reply: `Provided type cannot be reloaded!`
			};
		}

		const module = sb[item.target];
		if (item.executionType === "upgrade") {
			const isPlural = (item.plural.includes(command));

			return await upgrade(context, module, item.dir ?? item.name, isPlural, ...rest);
		}
		else if (typeof item.execution === "function") {
			return await item.execution(context, command, ...rest);
		}

		if (command.endsWith("s")) {
			await module.reloadData();
			return {
				reply: `Reloaded the sb.${item.target} module completely.`
			};
		}
		else {
			if (!module.hasReloadSpecific()) {
				return {
					success: false,
					reply: `This module does not support reloading a specific item!`
				};
			}

			const result = await module.reloadSpecific(...rest);
			if (result === false) {
				return {
					success: false,
					reply: `No ${item.target}s reloaded!`
				};
			}

			return {
				reply: `Reloaded ${rest.length} specific sb.${item.target}(s) successfully.`
			};
		}
	}),
	Dynamic_Description: null
};
