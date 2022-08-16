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
		const shell = require("util").promisify(require("child_process").exec);
		const upgrade = async (context, module, name, isPlural, ...list) => {
			if (!isPlural && list.length === 0) {
				return {
					success: false,
					reply: `No ${name} names provided!`
				};
			}

			if (context.params.skipUpgrade !== true) {
				const emote = await context.getBestAvailableEmote(["ppCircle", "supiniLoading"], "⏳");
				const message = `${emote} running yarn upgrade, please wait ${emote}`;

				await context.sendIntermediateMessage(message);
				await shell("yarn upgrade supi-core");
			}

			if (isPlural) {
				try {
					await module.reloadData();
				}
				catch (e) {
					await sb.Logger.log("Command.Warning", JSON.stringify(e));
					return {
						success: false,
						reply: `An error occured while reloading all ${name}!`
					};
				}

				return {
					reply: `Reloaded all ${name} successfully.`
				};
			}
			else {
				const result = await module.reloadSpecific(...list);
				if (result.failed.length === 0) {
					return {
						reply: `${list.length} ${name}s reloaded successfully.`
					};
				}
				else if (result.failed.length < list.length) {
					return {
						success: false,
						reply: `${list.length - result.failed.length} ${name}s reloaded successfully, but ${result.failed.length} failed!`
					};
				}
				else {
					return {
						success: false,
						reply: `All ${list.length} ${name}s failed to reload!`
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
					names: ["chatmodule", "chatmodules", "chat-module", "chat-modules"],
					singular: ["chatmodule", "chat-module"],
					plural: ["chatmodules", "chat-modules"]
				},
				{
					executionType: "upgrade",
					target: "Command",
					name: "command",
					names: ["command", "commands"],
					singular: ["command"],
					plural: ["commands"]
				},
				{
					target: "Config",
					names: ["config", "configs"]
				},
				{
					executionType: "upgrade",
					target: "Cron",
					name: "cron",
					names: ["cron", "crons"],
					singular: ["cron"],
					plural: ["crons"]
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
								reply: `${names.length} user(s) reload successfully.`
							};
						}
						else {
							await sb.User.reloadData();
							return {
								reply: `All users reload successfully.`
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

			return await upgrade(context, module, item.name, isPlural, ...rest);
		}
		else if (typeof item.execution === "function") {
			return await item.execution(context, command, ...rest);
		}

		if (command.endsWith("s")) {
			await module.reloadData();
			return {
				reply: `Reloaded sb.${item.target} completely.`
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
