module.exports = {
	Name: "alias",
	Aliases: ["$"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "This command lets you create your own aliases (shorthands) for any other combination of commands and arguments. Check the extended help for step-by-step info.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		aliasLimit: 10,
		nameCheck: {
			regex: /^[-\w\u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff]{2,25}$/,
			response: "Your alias should only contain letters, numbers and be 2-25 characters long."
		},

		applyParameters: (context, aliasArguments, commandArguments) => {
			const resultArguments = [];
			const numberRegex = /\${(?<order>\d+)(-(?<range>\d+))?(?<rest>\+?)?}/;
			const keywordRegex = /\${(channel|executor)}/;

			for (const arg of aliasArguments) {
				if (numberRegex.test(arg)) {
					let result = arg;
					const iteratorRegex = new RegExp(numberRegex, "g");
					const iterator = arg.matchAll(iteratorRegex);

					for (const match of iterator) {
						const { groups } = match;
						const item = match[0];

						const order = Number(groups.order);
						if (!sb.Utils.isValidInteger(order)) {
							return {
								success: false,
								reply: `Invalid parameter order for argument "${arg}"!`
							};
						}

						if (groups.rest && groups.range) {
							return {
								success: false,
								reply: `Can't combine range and rest parameters in argument "${arg}"!`
							};
						}

						let replacement = null;
						if (groups.rest) {
							replacement = commandArguments.slice(order).join(" ");
						}
						else if (groups.range) {
							const range = Number(groups.range);
							if (!sb.Utils.isValidInteger(range)) {
								return {
									success: false,
									reply: `Invalid range parameter for argument "${arg}"!`
								};
							}
							else if (order >= range) {
								return {
									success: false,
									reply: `The end of a range must be greater than the start of it in argument "${arg}"!`
								};
							}

							replacement = commandArguments.slice(order, range + 1).join(" ");
						}
						else {
							replacement = commandArguments[order] ?? "";
						}

						result = result.replace(item, replacement);
					}

					resultArguments.push(...result.split(" "));
				}
				else if (keywordRegex.test(arg)) {
					const type = arg.match(keywordRegex)[1];
					const replacerRegex = new RegExp(keywordRegex, "g");

					if (type === "channel") {
						resultArguments.push(arg.replace(replacerRegex, context.channel?.Name ?? "[whispers]"));
					}
					else if (type === "executor") {
						resultArguments.push(arg.replace(replacerRegex, context.user.Name));
					}
					else {
						return {
							success: false,
							reply: `This shouldn't happen :)`
						};
					}
				}
				else {
					resultArguments.push(arg);
				}
			}

			return {
				success: true,
				resultArguments
			};
		}
	})),
	Code: (async function alias (context, type, ...args) {
		if (context.invocation === "$") {
			args = [type, ...args]; // This the command name
			type = "run"; // This is the implicit subcommand
		}

		if (!type) {
			return {
				reply: sb.Utils.tag.trim `
					This command lets you create your own command aliases.
					Check the extended help here:
					https://supinic.com/bot/command/${this.ID}
					If you created some, check your list here:
					https://supinic.com/user/alias/list
				`
			};
		}

		if (!context.user.Data.aliasedCommands) {
			context.user.Data.aliasedCommands = {};
			await context.user.saveProperty("Data");
		}

		let changed = false;
		let reply = "Unexpected reply! Contact @Supinic about this.";
		const wrapper = new Map(Object.entries(context.user.Data.aliasedCommands));

		type = type.toLowerCase();
		switch (type) {
			case "add":
			case "create": {
				const [name, command, ...rest] = args;
				if (!name || !command) {
					return {
						success: false,
						reply: `You didn't provide a name, or a command! Use: alias add (name) (command) (...arguments)"`
					};
				}
				else if (wrapper.has(name)) {
					return {
						success: false,
						reply: `Cannot add alias "${name}" - you already have one! You can either _edit_ its definion, _rename_ it or _remove_ it.`
					};
				}
				else if (!this.staticData.nameCheck.regex.test(name)) {
					return {
						success: false,
						reply: `Your alias name is not valid! ${this.staticData.nameCheck.response}`
					};
				}

				const commandCheck = sb.Command.get(command);
				if (!commandCheck) {
					return {
						success: false,
						reply: `Cannot create alias! The command "${command}" does not exist.`
					};
				}

				changed = true;
				wrapper.set(name, {
					name,
					invocation: command,
					args: rest,
					created: new sb.Date().toJSON(),
					lastEdit: null
				});

				reply = `Your alias "${name}" has been created successfully.`;
				break;
			}

			case "check": {
				const [name] = args;
				if (!name) {
					return {
						reply: `Check all your aliases here: https://supinic.com/bot/user/${context.user.Name}/alias/list`
					};
				}
				else if (!wrapper.has(name)) {
					return {
						success: false,
						reply: "You don't have an alias with that name!"
					};
				}

				const { invocation, args: commandArgs } = wrapper.get(name);
				return {
					reply: `Your alias "${name}" has this definition: ${invocation} ${commandArgs.join(" ")}`
				};
			}

			case "copy": {
				const [targetUser, targetAlias] = args;
				if (!targetUser) {
					return {
						success: false,
						reply: "No target username provided!"
					};
				}
				else if (!targetAlias) {
					return {
						success: false,
						reply: "No target alias provided!"
					};
				}

				const target = await sb.User.get(targetUser);
				if (!target) {
					return {
						success: false,
						reply: "Invalid user provided!"
					};
				}

				const aliases = target.Data.aliasedCommands;
				if (!aliases || Object.keys(aliases).length === 0) {
					return {
						success: false,
						reply: "They currently don't have any aliases!"
					};
				}
				else if (!aliases[targetAlias]) {
					return {
						success: false,
						reply: "They don't have an alias with that name!"
					};
				}

				const alias = aliases[targetAlias];
				return await this.execute(
					context,
					"add",
					targetAlias,
					alias.invocation,
					...alias.args
				);
			}

			case "edit": {
				const [name, command, ...rest] = args;
				if (!name || !command) {
					return {
						success: false,
						reply: `No alias or command name provided!"`
					};
				}
				else if (!wrapper.has(name)) {
					return {
						success: false,
						reply: `You don't have an alias with this name!`
					};
				}

				const commandCheck = sb.Command.get(command);
				if (!commandCheck) {
					return {
						success: false,
						reply: `Cannot edit alias! The command "${command}" does not exist.`
					};
				}

				const obj = wrapper.get(name);
				obj.invocation = command;
				obj.args = rest;
				obj.lastEdit = new sb.Date().toJSON();

				changed = true;
				reply = `Your alias "${name}" has been successfully edited.`;

				break;
			}

			case "list": {
				return {
					reply: `Check your aliases here: https://supinic.com/bot/user/${context.user.Name}/alias/list`
				};
			}

			case "delete":
			case "remove": {
				const [name] = args;
				if (!name) {
					return {
						success: false,
						reply: `No alias name provided!`
					};
				}
				else if (!wrapper.has(name)) {
					return {
						success: false,
						reply: "You don't have an alias with that name!"
					};
				}

				changed = true;
				wrapper.delete(name);
				reply = `Your alias "${name}" has been succesfully removed.`;

				break;
			}

			case "rename": {
				const [oldName, newName] = args;
				if (!oldName || !newName) {
					return {
						success: false,
						reply: "You must provide both the current alias name and the new one!"
					};
				}
				else if (!wrapper.has(oldName)) {
					return {
						success: false,
						reply: "Can't rename - you don't have an alias with that name!"
					};
				}

				changed = true;
				wrapper.set(newName, wrapper.get(oldName));
				wrapper.get(newName).lastEdit = new sb.Date().toJSON();
				wrapper.get(newName).name = newName;
				wrapper.delete(oldName);

				reply = `Your alias "${oldName}" has been succesfully renamed to "${newName}".`;

				break;
			}

			case "run": {
				const [name] = args;
				if (!name) {
					return {
						success: false,
						reply: "No alias name provided!"
					};
				}
				else if (!wrapper.has(name)) {
					return {
						success: false,
						reply: "You don't have an alias with that name!"
					};
				}

				const { invocation, args: aliasArguments } = wrapper.get(name);
				const { success, reply, resultArguments } = this.staticData.applyParameters(context, aliasArguments, args.slice(1));
				if (!success) {
					return { success, reply };
				}

				const commandData = sb.Command.get(invocation);
				if (context.append.pipe && !commandData.Flags.pipe) {
					return {
						success: false,
						reply: `Cannot use command ${invocation} inside of a pipe, despite being wrapped in an alias!`
					};
				}

				const aliasCount = (context.append.aliasCount ?? 0) + 1;
				if (aliasCount > this.staticData.aliasLimit) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							Your alias cannot continue!
							It causes more than ${this.staticData.aliasLimit} alias calls.
							Please reduce the complexity first.
						`
					};
				}

				const result = await sb.Command.checkAndExecute(
					invocation,
					resultArguments,
					context.channel,
					context.user,
					{
						...context.append,
						alias: true,
						aliasCount,
						platform: context.platform,
						skipPending: true,
						skipMention: true,
						partialExecute: true
					}
				);

				return {
					...result,
					aliased: true
				};
			}

			case "spy": {
				const [targetUser, targetAlias] = args;
				if (!targetUser) {
					return {
						success: false,
						reply: "No target user provided!"
					};
				}

				const target = await sb.User.get(targetUser);
				if (!target) {
					return {
						success: false,
						reply: "Invalid user provided!"
					};
				}

				const suffix = (targetAlias)
					? `?columnName=${encodeURIComponent(targetAlias)}`
					: "";

				return {
					reply: `Check their aliases here: https://supinic.com/bot/user/${encodeURIComponent(target.Name)}/alias/list${suffix}`
				};
			}

			default: return {
				success: false,
				reply: sb.Utils.tag.trim `
					Invalid sub-command provided!
					Check the extended help here:
				   	https://supinic.com/bot/command/${this.ID}
				`
			}
		}

		if (changed) {
			context.user.Data.aliasedCommands = Object.fromEntries(wrapper);
			await context.user.saveProperty("Data");
		}

		return { reply };
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Meta-command that lets you create aliases (or shorthands) for existing commands or their combinations.",
			"You have to first create an alias, and then run it. You can manage your aliases by listing, checking, removing and adding.",
			"",

			`<h5>What's an alias?</h5>`,
			`An alias is a word that lets you quickly use a command without typing the entirity of it.`,
			`E.g.: You don't want to type <code>${prefix}weather New York, USA</code> every time, so you create an alias called <code>ny</code>.`,
			`Then, you can simply use the alias like so: <code>${prefix}$ ny</code>`,
			"",

			`<h5>Usage</h5>`,
			`<code>${prefix}alias add (name) (definition)</code>`,
			`<code>${prefix}alias create (name) (definition)</code>`,
			`Creates your command alias, e.g.:`,
			`<code>${prefix}alias add <u>hello</u> translate to:german Hello!</code>`,
			"",

			`<code>${prefix}$ (name)</code>`,
			`<code>${prefix}alias run (name)</code>`,
			"Runs your command alias!, e.g.:",

			`<code>${prefix}$ <u>hello</u></code> => Hallo!`,
			`<code>${prefix}alias run <u>hello</u></code> => Hallo!`,
			"",

			`<code>${prefix}alias copy (username) (alias)</code>`,
			"Takes someone else's alias, and attempts to copy it with the same name for you. Behaves like <code>add</code>, so if you have an alias with the same name, the copying will fail",
			`<code>${prefix}alias copy supinic lol</code>`,
			"",

			`<code>${prefix}alias check (name)</code>`,
			"Posts the definition of given alias to chat, e.g.:",
			`<code>${prefix}alias check <u>hello</u></code> => "translate to:german Hello!"`,
			"",

			`<code>${prefix}alias edit (name)</code>`,
			"Edits an existing alias, without the need of removing and re-adding it.",
			`<code>${prefix}alias edit <u>hello</u></code> => "translate to:italian Hello!"`,
			"",

			`<code>${prefix}alias rename (old-name) (new-name)</code>`,
			"Renames your command alias from old-name to new-name.",
			"",

			`<code>${prefix}alias list</code>`,
			"Lists all your currently active aliases.",
			`You can also check them in <a href="/user/alias/list">this list</a> - after you log in.`,
			"",

			`<code>${prefix}alias delete (name)</code>`,
			`<code>${prefix}alias remove (name)</code>`,
			"Removes your command alias with the given name.",
			"",

			`<code>${prefix}alias spy (user)</code>`,
			"Lists all active aliases the target person currently has.",
			"",

			`<code>${prefix}alias spy (user) (name)</code>`,
			"Posts the definition of the alias with given name, that belongs to given person.",
			"",

			"<h5>Replacements</h5>",
			"Replaces a symbol in your alias with a value depending on its name.",
			`<ul>
				<li>
					<code>\${#}</code> (e.g. \${0}, \${1}, ...)
					<br>
					Replaced by argument number # in your alias execution.
					<br>
					<code>${prefix}alias add test translate to:\${0} hello!</code>
					<br>
					<code>${prefix}alias run test spanish</code> => <code>${prefix}translate to:spanish hello</code>
				</li>
				<br>
				<li>
					<code>\${#+}</code> (e.g. \${0+}, \${1+}, ...)
					<br>
					Replaced by argument number # and all the following arguments in your alias execution.
					<br>
					<code>${prefix}alias add test translate to:\${0} hello, \${1+}!</code>
					<br>
					<code>${prefix}alias run test spanish my friends</code> => <code>${prefix}translate to:spanish hello, my friends!</code>
				</li>
				<br>
				<li>
					<code>\${#-#}</code> (e.g. \${0-1}, \${1-10}, ...)
					<br>
					Replaced by argument number #1 and all the following arguments until #2, inclusive.
					<br>
					<code>${prefix}alias add test translate to:german hello, \${0-2}!</code>
					<br>
					<code>${prefix}alias run test spanish hello there again - my friends!</code> => <code>${prefix}translate to:german hello there again</code>
				</li>
				<br>
				<li>
					<code>\${channel}</code>
					<br>
					The channel name the alias is run in.
					<br>
					<code>${prefix}alias add test remind \${channel} hello!</code>
					<br>
					<code>${prefix}alias run test</code> => <code>${prefix}remind (channel-name) hello!</code>
				</li>
				<br>
				<li>
					<code>\${executor}</code>
					<br>
					The username of the person running the alias.
					<br>
					<code>${prefix}alias add test remind person hello from \${executor}!</code>
					<br>
					<code>${prefix}alias run test</code> => <code>${prefix}remind person hello from (you)!</code>
				</li>
			</ul>`
		];
	})
};