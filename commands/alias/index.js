module.exports = {
	Name: "alias",
	Aliases: ["$"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "This command lets you create your own aliases (shorthands) for any other combination of commands and arguments. Check the extended help for step-by-step info.",
	Flags: ["external-input","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		aliasLimit: 10,
		descriptionLimit: 250,
		nameCheck: {
			regex: /^[-\w\u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff]{2,30}$/,
			response: "Your alias should only contain letters, numbers and be 2-30 characters long."
		},

		applyParameters: (context, aliasArguments, commandArguments) => {
			const resultArguments = [];
			const numberRegex = /(?<order>-?\d+)(\.\.(?<range>-?\d+))?(?<rest>\+?)/;

			for (let i = 0; i < aliasArguments.length; i++) {
				const parsed = aliasArguments[i].replace(/\${(.+?)}/g, (total, match) => {
					const numberMatch = match.match(numberRegex);
					if (numberMatch) {
						let order = Number(numberMatch.groups.order);
						if (order < 0) {
							order = commandArguments.length + order;
						}

						let range = (numberMatch.groups.range) ? Number(numberMatch.groups.range) : null;
						if (typeof range === "number") {
							if (range < 0) {
								range = commandArguments.length + range + 1;
							}

							if (range < order) {
								const temp = range;
								range = order;
								order = temp;
							}
						}

						const useRest = (numberMatch.groups.rest === "+");
						if (useRest && range) {
							return {
								success: false,
								reply: `Cannot combine both the "range" and "rest" argument identifiers!`
							};
						}
						else if (useRest) {
							return commandArguments.slice(order).join(" ");
						}
						else if (range) {
							return commandArguments.slice(order, range).join(" ");
						}
						else {
							return commandArguments[order] ?? "";
						}
					}
					else if (match === "executor") {
						return context.user.Name;
					}
					else if (match === "channel") {
						return context.channel?.Description ?? context.channel?.Name ?? "[whispers]";
					}
					else {
						return total;
					}
				});

				resultArguments.push(...parsed.split(" "));
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
			case "addedit":
			case "create":
			case "upsert": {
				const [name, command, ...rest] = args;
				if (!name || !command) {
					return {
						success: false,
						reply: `You didn't provide a name, or a command! Use: alias add (name) (command) (...arguments)"`
					};
				}
				else if (wrapper.has(name) && type !== "addedit" && type !== "upsert") {
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

				if (type === "add" || type === "create") {
					reply = `Your alias "${name}" has been created successfully.`;
				}
				else {
					reply = `Your alias "${name}" has been replaced successfully.`;
				}

				break;
			}

			case "code":
			case "check":
			case "list":
			case "spy": {
				let user;
				let aliasName;
				let prefix;

				const [firstName, secondName] = args;
				if (type === "list" || (!firstName && !secondName)) {
					const username = encodeURIComponent(context.user.Name);
					return {
						reply: `List of your aliases: https://supinic.com/bot/user/${username}/alias/list`
					};
				}
				else if (firstName && !secondName) {
					const targetUser = await sb.User.get(firstName);
					const targetAliases = (targetUser)
						? Object.keys(targetUser.Data.aliasedCommands ?? {})
						: [];

					// Not a username nor current user's alias name - error out
					if (targetAliases.length === 0 && !wrapper.has(firstName)) {
						return {
							success: false,
							reply: `Could not match your input to username or any of your aliases!`
						};
					}
					// Not a username, but current user has an alias with the provided name
					else if (targetAliases.length === 0 && wrapper.has(firstName)) {
						user = context.user;
						aliasName = firstName;
						prefix = "Your";
					}
					// Not current user's alias, but a username exists
					else if (targetAliases.length > 0 && !wrapper.has(firstName)) { // Is a username
						const who = (targetUser === context.user) ? "your" : "their";
						const username = encodeURIComponent(targetUser.Name);
						return {
							reply: `List of ${who} aliases: https://supinic.com/bot/user/${username}/alias/list`
						};
					}
					// Both current user's alias, and a username exists - print out special case with both links
					else {
						const username = encodeURIComponent(context.user.Name);
						const escapedString = encodeURIComponent(firstName);
						return {
							reply: sb.Utils.tag.trim `
								Special case! 
								Your alias "${firstName}": https://supinic.com/bot/user/${username}/alias/detail/${escapedString}
								List of ${firstName}'s aliases: https://supinic.com/bot/user/${escapedString}/alias/list
							`
						};
					}
				}
				else {
					user = await sb.User.get(firstName);
					if (!user) {
						return {
							success: false,
							reply: "Provided user does not exist!"
						};
					}

					aliasName = secondName;
					prefix = (context.user === user) ? "Your" : "Their";

					const userAliases = Object.keys(user.Data.aliasedCommands ?? {});
					if (!userAliases.includes(aliasName)) {
						const who = (context.user === user) ? "You" : "They";
						return {
							success: false,
							reply: `${who} don't have the "${aliasName}" alias!`
						};
					}
				}

				let message;
				const alias = user.Data.aliasedCommands[aliasName];
				if (type === "code") {
					message = `${alias.invocation} ${alias.args.join(" ")}`;
				}
				else {
					message = `${prefix} alias "${aliasName}" has this definition: ${alias.invocation} ${alias.args.join(" ")}`;
				}

				const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
				const cooldown = (context.append.pipe) ? null : this.Cooldown;

				if (message.length >= limit) {
					const escapedAliasName = encodeURIComponent(aliasName);
					const escapedUsername = encodeURIComponent(user.Name);
					let prefix = "";
					if (type !== "code") {
						prefix = `${prefix} alias "${firstName}" details: `;
					}

					return {
						cooldown,
						reply: `${prefix}https://supinic.com/bot/user/${escapedUsername}/alias/detail/${escapedAliasName}`
					};
				}
				else {
					return {
						cooldown,
						reply: message
					};
				}
			}

			case "copy":
			case "copyplace": {
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
						reply: `They don't have the "${targetAlias}" alias!`
					};
				}

				const alias = aliases[targetAlias];
				if (wrapper.has(targetAlias) && type !== "copyplace") {
					return {
						success: false,
						reply: `Cannot copy alias "${targetAlias} - you already have it! If you want to copy + replace, use "alias copyplace".`
					};
				}

				const operation = (type === "copy") ? "add" : "upsert";
				return await this.execute(
					context,
					operation,
					targetAlias,
					alias.invocation,
					...alias.args
				);
			}

			case "describe": {
				const [name, ...rest] = args;
				if (!name) {
					return {
						success: false,
						reply: `You didn't provide a name, or a command! Use: alias add (name) (command) (...arguments)"`
					};
				}
				else if (!wrapper.has(name)) {
					return {
						success: false,
						reply: `You don't have the "${name}" alias!`
					};
				}

				const description = rest.join(" ").trim();
				if (description.length > this.staticData.descriptionLimit) {
					return {
						success: false,
						reply: `Your description exceeds the limit of ${this.staticData.descriptionLimit} characters!`
					};
				}

				let verb;
				const obj = wrapper.get(name);
				if (description.length === 0 || description === "none") {
					obj.desc = "";
					verb = "reset";
				}
				else {
					obj.desc = description;
					verb = "updated";
				}

				reply = `The description of your alias "${name}" has been ${verb} successfully.`;
				changed = true;
				obj.lastEdit = new sb.Date().toJSON();

				break;
			}

			case "duplicate": {
				const [oldAlias, newAlias] = args;
				if (!oldAlias || !newAlias) {
					return {
						reply: `To duplicate an alias, you must provide both existing and new alias names!`
					};
				}
				else if (!wrapper.has(oldAlias)) {
					return {
						success: false,
						reply: `You don't have the "${oldAlias}" alias!`
					};
				}
				else if (wrapper.has(newAlias)) {
					return {
						success: false,
						reply: `You already have the "${newAlias}" alias!`
					};
				}

				const previous = wrapper.get(oldAlias);
				wrapper.set(newAlias, {
					name: newAlias,
					invocation: previous.invocation,
					args: previous.args,
					desc: previous.desc ?? "",
					created: new sb.Date().toJSON(),
					lastEdit: null
				});

				reply = `Successfully duplicated "${oldAlias}" as "${newAlias}"!`;
				changed = true;
				break;
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
						reply: `You don't have the "${name}" alias!`
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

			case "inspect": {
				let user;
				let aliasName;
				let prefix;

				const [firstName, secondName] = args;
				if (!firstName && !secondName) {
					return {
						success: false,
						reply: `You didn't provide an alias or user name! Use: "$alias inspect (your alias)" or "$alias inspect (username) (alias)"`
					};
				}
				else if (firstName && !secondName) {
					user = context.user;
					aliasName = firstName;
					prefix = "You";
				}
				else {
					user = await sb.User.get(firstName);
					if (!user) {
						return {
							success: false,
							reply: "Provided user does not exist!"
						};
					}

					aliasName = secondName;
					prefix = (context.user === user) ? "You" : "They";
				}

				const aliases = user.Data.aliasedCommands;
				if (!aliases) {
					return {
						success: false,
						reply: `${prefix} don't have any aliases!`
					};
				}

				const alias = aliases[aliasName];
				if (!alias) {
					return {
						success: false,
						reply: `${prefix} don't have the "${aliasName}" alias!`
					};
				}

				const description = alias.desc;
				return {
					cooldown: (context.append.pipe) ? null : this.Cooldown,
					reply: (description)
						? `${aliasName}: ${description}`
						: `Alias "${aliasName}" has no description.`
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
						reply: `You don't have the "${name}" alias!`
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
						reply: `You don't have the "${oldName}" alias!`
					};
				}
				else if (!this.staticData.nameCheck.regex.test(newName)) {
					return {
						success: false,
						reply: `Your new alias name is not valid! ${this.staticData.nameCheck.response}`
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
						reply: `You don't have the "${name}" alias!`
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
						aliasStack: [...(context.append.aliasStack ?? []), name],
						platform: context.platform,
						skipBanphrases: true,
						skipMention: true,
						skipPending: true,
						partialExecute: true
					}
				);

				return {
					...result,
					cooldown: (context.append.pipe) ? null : this.Cooldown,
					hasExternalInput: Boolean(result?.hasExternalInput ?? commandData.Flags.externalInput)
				};
			}

			default: return {
				success: false,
				reply: sb.Utils.tag.trim `
					Invalid sub-command provided!
					Check the extended help here:
				   	https://supinic.com/bot/command/${this.ID}
				`
			};
		}

		if (changed) {
			context.user.Data.aliasedCommands = Object.fromEntries(wrapper);
			await context.user.saveProperty("Data");
		}

		return { reply };
	}),
	Dynamic_Description: (async (prefix) => [
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
		`<code>${prefix}alias copyplace (username) (alias)</code>`,
		"Takes someone else's alias, and attempts to copy it with the same name for you.",
		"If you use <code>copy</code>, it will only create an alias if you don't already have one with that name.",
		"If you use <code>copyplace</code>, it will replace whatever alias you have with that name without asking.",
		"",

		`<code>${prefix}alias check</code>`,
		`<code>${prefix}alias spy</code>`,
		`<code>${prefix}alias code</code>`,
		`<code>${prefix}alias check (alias)</code>`,
		`<code>${prefix}alias check (user)</code>`,
		`<code>${prefix}alias check (user) (alias)</code>`,
		"Checks your or someone else's aliases.",
		"You can use <code>alias spy</code> instead of <code>check</code>.",
		"You can use <code>alias code</code> instead of <code>check</code> - this will post the invocation directly, without fluff.",
		"No params - gives you the link with the list of your aliases.",
		"One param - your alias - gives you the definition of your alias with that name.",
		"One param - user name - gives you the link with the list of that user's aliases.",
		"Two param - user name + alias name - gives you the definition of that user's alias.",
		"",

		`<code>${prefix}alias edit (name)</code>`,
		"Edits an existing alias, without the need of removing and re-adding it.",
		`<code>${prefix}alias edit <u>hello</u> translate to:italian Hello!</code>`,
		"",

		`<code>${prefix}alias addedit (name) (definition)</code>`,
		`<code>${prefix}alias upsert (name) (definition)</code>`,
		`Creates a new alias, or updates an existing alias of your own. If you replace an existing one, you will lose its definition`,
		"",

		`<code>${prefix}alias rename (old-name) (new-name)</code>`,
		"Renames your command alias from old-name to new-name.",
		"",

		`<code>${prefix}alias duplicate (old-name) (new-name)</code>`,
		"Creates a new alias (new-name) with the definition of an existing alias (old-name).",
		"",

		`<code>${prefix}alias list</code>`,
		"Lists all your currently active aliases.",
		`You can also check them in <a href="/user/alias/list">this list</a> - after you log in.`,
		"",

		`<code>${prefix}alias delete (name)</code>`,
		`<code>${prefix}alias remove (name)</code>`,
		"Removes your command alias with the given name.",
		"",

		`<code>${prefix}alias describe (alias) (...description)</code>`,
		"Gives your command a description, which can then be checked by you or others.",
		`If you don't provide a description, or use the word "none" exactly, the description will be reset.`,
		"",

		`<code>${prefix}alias inspect (alias)</code>`,
		`<code>${prefix}alias inspect (username) (alias)</code>`,
		"If your or someone else's alias has a description, this command will print it to chat.",
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
					<code>\${#-#}</code> (e.g. \${0..1}, \${1..10}, ...)
					<br>
					Replaced by argument number #1 and all the following arguments until #2, inclusive.
					<br>
					<code>${prefix}alias add test translate to:german hello, \${0..2}!</code>
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
	])
};
