module.exports = {
	Name: "reload",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Reloads a database definition or hotloads an updated script",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
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
				target: "ChatModule",
				names: ["chatmodule", "chatmodules", "chat-module", "chat-modules"]
			},
			{
				target: "Command",
				names: ["command", "commands"],
				execution: async (invocation, ...list) => {
					if (invocation === "command" && list.length === 0) {
						return {
							success: false,
							reply: "No command names provided!"
						};
					}

					const shell = require("util").promisify(require("child_process").exec);
					await shell("yarn upgrade supi-core/supibot-package-manager");

					if (invocation === "commands") {
						try {
							await sb.Command.reloadData();
						}
						catch (e) {
							await sb.Logger.log("Command.Warning", JSON.stringify(e));
							return {
								success: false,
								reply: "An error occured while reloading all commands!"
							};
						}

						return {
							reply: `Reloaded all commands successfully.`
						};
					}
					else if (invocation === "command") {
						const result = await sb.Command.reloadSpecific(...list);
						if (result.failed.length === 0) {
							return {
								reply: `${list.length} commands reloaded successfully.`
							};
						}
						else if (result.failed.length < list.length) {
							return {
								success: false,
								reply: `${result.failed.length - list.length} commands reloaded successfully, but ${result.failed.length} failed!`
							};
						}
						else {
							return {
								success: false,
								reply: `All ${list.length} commands failed to reload!`
							};
						}
					}
				}
			},
			{
				target: "Config",
				names: ["config", "configs"]
			},
			{
				target: "Cron",
				names: ["cron", "crons"]
			},
			{
				target: "Filter",
				names: ["filter", "filters"]
			},
			{
				target: "Got",
				names: ["gots"]
			},
			{
				target: "Reminder",
				names: ["reminder", "reminders"]
			},
			{
				target: "User",
				names: ["user", "users"],
				execution: async (invocation, ...names) => {
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
	})),
	Code: (async function reload (context, command, ...rest) {
		const { types } = this.staticData;
		const item = types.find(i => i.names.includes(command));
		if (!item) {
			return {
				success: false,
				reply: `Provided type cannot be reloaded!`
			};
		}

		if (typeof item.execution === "function") {
			return await item.execution(command, ...rest);
		}

		const module = sb[item.target];
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
