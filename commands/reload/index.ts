import path from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { exec } from "node:child_process";

import config from "../../config.json" with { type: "json" };
import type { CommandDefinition, Context } from "../../classes/command.js";

const shell = promisify(exec);
const BASE_PATH = config.basePath;

const params = [{ name: "skipUpgrade", type: "boolean" }] as const;

export default {
	Name: "reload",
	Aliases: null,
	Cooldown: 0,
	Description: "Reloads a database definition or hotloads an updated script",
	Flags: ["pipe", "skip-banphrase", "system", "whitelist"],
	Params: params,
	Whitelist_Response: null,
	Code: (async function reload (context: Context<typeof params>, command, ...rest) {
		switch (command) {
			case "banphrase": {
				const ids = rest.map(Number).filter(i => !Number.isNaN(i));
				if (ids.length === 0) {
					return {
						success: false,
						reply: "No valid Banphrase IDs provided!"
					};
				}

				await sb.Banphrase.reloadSpecific(...ids);
				return {
					success: true,
					reply: `Reloaded ${ids.length} banphrases.`
				};
			}
			case "banphrases": {
				await sb.Banphrase.reloadData();
				return {
					success: true,
					reply: `Reloaded all banphrases.`
				};
			}

			case "channel": {
				await sb.Channel.reloadSpecific(...rest);
				return {
					success: true,
					reply: `Reloaded ${rest.length} channels.`
				};
			}
			case "channels": {
				await sb.Channel.reloadData();
				return {
					success: true,
					reply: `Reloaded all channels.`
				};
			}

			case "command": {
				await context.sendIntermediateMessage("ppCircle git pull ppCircle");
				await shell("git pull");

				await context.sendIntermediateMessage("ppCircle yarn build ppCircle");
				await shell("yarn build");

				const failures: string[] = [];
				const definitions: CommandDefinition[] = [];
				for (const name of rest) {
					const commandData = sb.Command.get(name);
					if (!commandData) {
						continue;
					}

					const hash = randomBytes(16).toString("hex");
					const filePath = path.join(BASE_PATH, "build", "commands", commandData.Name, `index.js?randomHash=${hash}`);
					try {
						const dynamicImports = await import(filePath) as { default: CommandDefinition };
						definitions.push(dynamicImports.default);
					}
					catch (e) {
						console.warn(e);
						failures.push(commandData.Name);
					}
				}

				if (definitions.length === 0) {
					return {
						success: false,
						reply: "No valid definitions reloaded!"
					};
				}

				sb.Command.importSpecific(...definitions);
				return {
					success: true,
					reply: `Reloaded ${definitions.length} commands, ${failures.length} errors.`
				};
			}
			case "commands": {
				return {
					success: false,
					reply: "Cannot reload all commands!"
				};
			}

			case "filter": {
				const ids = rest.map(Number).filter(i => !Number.isNaN(i));
				if (ids.length === 0) {
					return {
					    success: false,
					    reply: "No valid Filter IDs provided!"
					};
				}

				await sb.Filter.reloadSpecific(...ids);
				return {
				    success: true,
				    reply: `Reloaded ${ids.length} filters.`
				};
			}
			case "filters": {
				await sb.Filter.reloadData();
				return {
					success: true,
					reply: `Reloaded all filters.`
				};
			}

			case "user": {
				let counter = 0;
				for (const username of rest) {
					const userData = await sb.User.get(username);
					if (!userData) {
						continue;
					}

					await sb.User.invalidateUserCache(userData);
					counter++;
				}

				return {
				    success: true,
				    reply: `Reloaded ${counter} users.`
				};
			}
			case "users": {
				return {
					success: false,
					reply: "Cannot reload all users!"
				};
			}
		}

		return {
			success: false,
			reply: "Invalid reload target provided!"
		};
	}),
	Dynamic_Description: null
} satisfies CommandDefinition;
