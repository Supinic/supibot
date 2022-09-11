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
			const strictNumberRegex = /^[\d-.+]+$/;

			for (let i = 0; i < aliasArguments.length; i++) {
				const parsed = aliasArguments[i].replace(/\${(.+?)}/g, (total, match) => {
					const numberMatch = match.match(numberRegex);
					if (numberMatch && strictNumberRegex.test(match)) {
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
						return context.channel?.Description ?? context.channel?.Name ?? "[private messages]";
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
					${this.getDetailURL()}
					If you created some, check your list here:
					https://supinic.com/user/alias/list
				`
			};
		}

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
						reply: `You didn't provide a name, or a command! Usage: alias add (name) (command) (...arguments)"`
					};
				}
				else if (!this.staticData.nameCheck.regex.test(name)) {
					return {
						success: false,
						reply: `Your alias name is not valid! ${this.staticData.nameCheck.response}`
					};
				}

				const alias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Name", "Invocation", "Arguments")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
					.single()
					.limit(1)
				);

				if (alias && (type === "add" || type === "create")) {
					return {
						success: false,
						reply: `Cannot ${type} alias "${name}" - you already have one! You can either "edit" its definion, "rename" it or "remove" it.`
					};
				}

				const commandCheck = sb.Command.get(command);
				if (!commandCheck) {
					return {
						success: false,
						reply: `Cannot create alias! The command "${command}" does not exist.`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				if (alias) {
					await row.load(alias.ID);
				}

				row.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Name: name,
					Command: commandCheck.Name,
					Invocation: command,
					Arguments: (rest.length > 0) ? JSON.stringify(rest) : null,
					Created: new sb.Date(),
					Edited: null
				});

				await row.save({ skipLoad: true });
				return {
					reply: (type === "add" || type === "create")
						? `Your alias "${name}" has been created successfully.`
						: `Your alias "${name}" has been replaced successfully.`
				};
			}

			case "code":
			case "check":
			case "list":
			case "spy": {
				let user;
				let aliasName;
				let prefix;

				const [firstName, secondName] = args;
				if (!firstName && !secondName) {
					const username = encodeURIComponent(context.user.Name);
					return {
						reply: `List of your aliases: https://supinic.com/bot/user/${username}/alias/list`
					};
				}
				else if (firstName && !secondName) {
					const aliases = await sb.Query.getRecordset(rs => rs
						.select("Name")
						.from("data", "Custom_Command_Alias")
						.where("Channel IS NULL")
						.where("User_Alias = %n", context.user.ID)
						.flat("Name")
					);

					let targetAliases = [];
					const targetUser = await sb.User.get(firstName);
					if (targetUser) {
						targetAliases = await sb.Query.getRecordset(rs => rs
							.select("Name")
							.from("data", "Custom_Command_Alias")
							.where("Channel IS NULL")
							.where("User_Alias = %n",targetUser.ID)
							.flat("Name")
						);
					}

					// Not a username nor current user's alias name - error out
					if (targetAliases.length === 0 && !aliases.includes(firstName)) {
						return {
							success: false,
							reply: `Could not match your input to username or any of your aliases!`
						};
					}
					// Not a username, but current user has an alias with the provided name
					else if (targetAliases.length === 0 && aliases.includes(firstName)) {
						user = context.user;
						aliasName = firstName;
						prefix = "Your";
					}
					// Not current user's alias, but a username exists
					else if (targetAliases.length > 0 && !aliases.includes(firstName)) { // Is a username
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
				}

				let alias = await sb.Query.getRecordset(rs => rs
					.select("Command", "Invocation", "Arguments", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", aliasName)
					.limit(1)
					.single()
				);

				let appendix = "";
				if (!alias) {
					const who = (context.user === user) ? "You" : "They";
					return {
						success: false,
						reply: `${who} don't have the "${aliasName}" alias!`
					};
				}
				else if (alias.Command === null && alias.Parent !== null) {
					// special case for linked aliases
					alias = await sb.Query.getRecordset(rs => rs
						.select("User_Alias", "Name", "Command", "Invocation", "Arguments", "Parent")
						.from("data", "Custom_Command_Alias")
						.where("ID = %n", alias.Parent)
						.limit(1)
						.single()
					);

					const originalUser = await sb.User.get(alias.User_Alias);
					appendix = `This alias is a link to "${alias.Name}" made by ${originalUser.Name}.`;
				}
				else if (alias.Command === null && alias.Parent === null) {
					return {
						reply: `${prefix} alias is a link to a different alias, but the original has been deleted.`
					};
				}

				let message;
				const aliasArgs = (alias.Arguments) ? JSON.parse(alias.Arguments) : [];
				if (type === "code") {
					message = `${alias.Invocation} ${aliasArgs.join(" ")}`;
				}
				else {
					message = `${appendix} ${prefix} alias "${aliasName}" has this definition: ${alias.Invocation} ${aliasArgs.join(" ")}`;
				}

				const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
				const cooldown = (context.append.pipe) ? null : this.Cooldown;

				if (!context.append.pipe && message.length >= limit) {
					const escapedAliasName = encodeURIComponent(aliasName);
					const escapedUsername = encodeURIComponent(user.Name);
					const prefixMessage = (type !== "code")
						? `${prefix} alias "${aliasName}" details: `
						: "";

					return {
						cooldown,
						reply: `${prefixMessage}https://supinic.com/bot/user/${escapedUsername}/alias/detail/${escapedAliasName}`
					};
				}
				else {
					return {
						cooldown,
						reply: message
					};
				}
			}

			case "publish":
			case "unpublish": {
				if (!context.channel) {
					return {
						success: false,
						reply: `This subcommand can only be used in the channel you want the alias to be global in!`
					};
				}

				const permissions = await context.getUserPermissions();
				if (permissions.is(sb.User.permission.regular)) {
					return {
						success: false,
						reply: `Only the owner and ambassadors of this channel can use this subcommand!`
					};
				}

				const [user, aliasName] = args;
				if (!user || !aliasName) {
					return {
						success: false,
						reply: `No user or alias provided! Use syntax: $alias ${type} (user) (alias name)`
					};
				}

				const userData = await sb.User.get(user);
				if (!userData) {
					return {
						success: false,
						reply: `Provided user does not exist!`
					};
				}

				const [aliasID, existingID] = await Promise.all([
					sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("data", "Custom_Command_Alias")
						.where("User_Alias = %n", userData.ID)
						.where("Name = %s", aliasName)
						.single()
						.limit(1)
						.flat("ID")
					),
					sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("data", "Custom_Command_Alias")
						.where("User_Alias IS NULL")
						.where("Channel = %n", context.channel.ID)
						.where("Name = %s", aliasName)
						.single()
						.limit(1)
						.flat("ID")
					)
				]);

				if (type === "publish") {
					if (!aliasID) {
						return {
							success: false,
							reply: `That user does not have an alias with that name!`
						};
					}
					else if (existingID) {
						return {
							success: false,
							reply: `That alias has already been published in this channel!`
						};
					}

					const row = await sb.Query.getRow("data", "Custom_Command_Alias");
					row.setValues({
						Name: aliasName,
						Channel: context.channel.ID,
						Link: aliasID
					});

					await row.save({ skipLoad: true });
					return {
						reply: `Succesfully published alias ${aliasName} in this channel. Users in this channel can now use it directly.`
					};
				}
				else {
					if (!existingID) {
						return {
							success: false,
							reply: `That alias has not been published in this channel!`
						};
					}

					const row = await sb.Query.getRow("data", "Custom_Command_Alias");
					await row.load(existingID);
					await row.delete();

					return {
						reply: `Succesfully unpublished alias ${aliasName} in this channel. Users in this channel won't be able to use it directly.`
					};
				}
			}

			case "copy":
			case "copyplace": {
				const [targetUserName, targetAliasName] = args;
				if (!targetUserName) {
					return {
						success: false,
						reply: "No target username provided!"
					};
				}
				else if (!targetAliasName) {
					return {
						success: false,
						reply: "No target alias provided!"
					};
				}
				else if (!this.staticData.nameCheck.regex.test(targetAliasName)) {
					return {
						success: false,
						reply: "The copied alias's name is not valid and therefore can't be copied!"
					};
				}

				const targetUser = await sb.User.get(targetUserName);
				if (!targetUser) {
					return {
						success: false,
						reply: "Invalid user provided!"
					};
				}

				const targetAlias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Command", "Invocation", "Arguments", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", targetUser.ID)
					.where("Name COLLATE utf8mb4_bin = %s", targetAliasName)
					.limit(1)
					.single()
				);

				if (!targetAlias) {
					return {
						success: false,
						reply: `They don't have the "${targetAliasName}" alias!`
					};
				}
				else if (targetAlias.Command === null) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							You cannot copy links to other aliases
						 	Instead, use ${sb.Command.prefix}alias link ${targetUser.Name} ${targetAliasName}
						`
					};
				}

				const currentAlias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Command", "Invocation", "Arguments")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", targetAliasName)
					.limit(1)
					.single()
				);

				if (currentAlias && type !== "copyplace") {
					return {
						success: false,
						reply: `Cannot copy alias "${targetAliasName} - you already have it! If you want to copy + replace, use "alias copyplace".`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				if (currentAlias) {
					await row.load(currentAlias.ID);
				}

				row.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Name: targetAliasName,
					Command: targetAlias.Command,
					Invocation: targetAlias.Invocation,
					Arguments: targetAlias.Arguments,
					Description: null,
					Parent: targetAlias.ID,
					Created: new sb.Date(),
					Edited: null
				});

				await row.save({ skipLoad: true });

				const verb = (type === "copyplace") ? "copied and replaced" : "copied";
				return {
					reply: `Alias "${targetAliasName}" ${verb} successfully.`
				};
			}

			case "describe": {
				const [name, ...rest] = args;
				if (!name) {
					return {
						success: false,
						reply: `You didn't provide a name, or a command! Use: alias describe (name) (...description)"`
					};
				}

				const alias = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
					.limit(1)
					.single()
				);

				if (!alias) {
					return {
						success: false,
						reply: `You don't have the "${name}" alias!`
					};
				}

				const description = rest.join(" ").trim();
				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				await row.load(alias.ID);

				let verb;
				if (description.length === 0 || description === "none") {
					row.values.Description = null;
					verb = "reset";
				}
				else {
					row.values.Description = description;
					verb = "updated";
				}

				await row.save({ skipLoad: true });
				return {
					reply: `The description of your alias "${name}" has been ${verb} successfully.`
				};
			}

			case "duplicate": {
				const [oldAliasName, newAliasName] = args;
				if (!oldAliasName || !newAliasName) {
					return {
						reply: `To duplicate an alias, you must provide both existing and new alias names!`
					};
				}
				else if (!this.staticData.nameCheck.regex.test(newAliasName)) {
					return {
						success: false,
						reply: `Your alias name is not valid! ${this.staticData.nameCheck.response}`
					};
				}

				const oldAlias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Command", "Invocation", "Arguments", "Description", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", oldAliasName)
					.limit(1)
					.single()
				);
				if (!oldAlias) {
					return {
						success: false,
						reply: `You don't have the "${oldAliasName}" alias!`
					};
				}
				else if (oldAlias.Command === null) {
					return {
						success: false,
						reply: `You cannot duplicate links to other aliases!`
					};
				}

				const newAlias = await sb.Query.getRecordset(rs => rs
					.select("Command", "Invocation", "Arguments", "Description")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", newAliasName)
					.limit(1)
					.single()
				);
				if (newAlias) {
					return {
						success: false,
						reply: `You already have the "${newAliasName}" alias!`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				row.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Name: newAliasName,
					Command: oldAlias.Command,
					Invocation: oldAlias.Invocation,
					Arguments: oldAlias.Arguments,
					Description: null,
					Parent: oldAlias.ID,
					Created: new sb.Date(),
					Edited: null
				});

				await row.save();
				return {
					reply: `Successfully duplicated "${oldAliasName}" as "${newAliasName}"!`
				};
			}

			case "edit": {
				const [name, command, ...rest] = args;
				if (!name || !command) {
					return {
						success: false,
						reply: `No alias or command name provided!"`
					};
				}

				const commandCheck = sb.Command.get(command);
				if (!commandCheck) {
					return {
						success: false,
						reply: `Cannot edit alias! The command "${command}" does not exist.`
					};
				}

				const alias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Command", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
					.limit(1)
					.single()
				);
				if (!alias) {
					return {
						success: false,
						reply: `You don't have the "${name}" alias!`
					};
				}
				else if (alias.Command === null) {
					return {
						success: false,
						reply: `You cannot edit links to other aliases!`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				await row.load(alias.ID);
				row.setValues({
					Command: commandCheck.Name,
					Invocation: command,
					Arguments: (rest.length > 0) ? JSON.stringify(rest) : null
				});

				await row.save({ skipLoad: true });
				return {
					reply: `Your alias "${name}" has been successfully edited.`
				};
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

				const alias = await sb.Query.getRecordset(rs => rs
					.select("Description")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", aliasName)
					.limit(1)
					.single()
				);

				if (!alias) {
					return {
						success: false,
						reply: `${prefix} don't have the "${aliasName}" alias!`
					};
				}

				return {
					cooldown: (context.append.pipe) ? null : this.Cooldown,
					reply: (alias.Description)
						? `${aliasName}: ${alias.Description}`
						: `Alias "${aliasName}" has no description.`
				};
			}

			case "link": {
				const [userName, aliasName] = args;
				if (!userName || !aliasName) {
					return {
						success: false,
						reply: `You didn't provide a user, or the alias name! Use: alias link (user) (alias name)`
					};
				}

				const existing = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", aliasName)
					.single()
					.flat("ID")
					.limit(1)
				);
				if (existing) {
					return {
						success: false,
						reply: `Cannot link a new alias - you already have an alias with this name!`
					};
				}

				const userData = await sb.User.get(userName);
				if (!userData) {
					return {
						success: false,
						reply: `Provided user does not exist!`
					};
				}

				let targetAlias = await sb.Query.getRecordset(rs => rs
					.select("ID", "Name", "Description", "Command", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", userData.ID)
					.where("Name COLLATE utf8mb4_bin = %s", aliasName)
					.single()
					.limit(1)
				);

				let appendix = "";

				if (!targetAlias) {
					return {
						success: false,
						reply: `Provided user does not have the "${aliasName}" alias!`
					};
				}
				else if (targetAlias.Command === null && targetAlias.Parent !== null) {
					// If attempting to link an already linked alias, change the pointer to the original alias
					targetAlias = await sb.Query.getRecordset(rs => rs
						.select("ID", "User_Alias", "Name", "Description", "Command", "Parent")
						.from("data", "Custom_Command_Alias")
						.where("ID = %n", targetAlias.Parent)
						.single()
						.limit(1)
					);

					const originalUser = await sb.User.get(targetAlias.User_Alias);
					appendix = `You tried to create a link out of an already linked alias (alias ${targetAlias.Name} by ${originalUser.Name}), so I used the original as your template.`;
					targetAlias.Name = aliasName;
				}
				else if (targetAlias.Command === null && targetAlias.Parent === null) {
					return {
						success: false,
						reply: `Unfortunately, it looks like the original alias has been removed!`
					};
				}
				else if (!this.staticData.nameCheck.regex.test(targetAlias.Name)) {
					return {
						success: false,
						reply: `Linked alias name is not valid! ${this.staticData.nameCheck.response}`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				row.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Name: targetAlias.Name,
					Command: null,
					Invocation: null,
					Arguments: null,
					Created: new sb.Date(),
					Edited: null,
					Description: targetAlias.Description,
					Parent: targetAlias.ID
				});

				await row.save({ skipLoad: true });

				return {
					reply: `Successfully created the alias link! When the original changes, so will yours. ${appendix}`
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

				const alias = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
					.limit(1)
					.single()
				);
				if (!alias) {
					return {
						success: false,
						reply: `You don't have the "${name}" alias!`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				await row.load(alias.ID);

				await row.delete();
				return {
					success: false,
					reply: `Your alias "${name}" has been successfully removed.`
				};
			}

			case "rename": {
				const [oldAliasName, newAliasName] = args;
				if (!oldAliasName || !newAliasName) {
					return {
						success: false,
						reply: "You must provide both the current alias name and the new one!"
					};
				}
				else if (!this.staticData.nameCheck.regex.test(newAliasName)) {
					return {
						success: false,
						reply: `Your new alias name is not valid! ${this.staticData.nameCheck.response}`
					};
				}

				const oldAlias = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", oldAliasName)
					.limit(1)
					.single()
				);
				if (!oldAlias) {
					return {
						success: false,
						reply: `You don't have the "${oldAliasName}" alias!`
					};
				}

				const newAlias = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", newAliasName)
					.limit(1)
					.single()
				);
				if (newAlias) {
					return {
						success: false,
						reply: `You already have the "${newAliasName}" alias!`
					};
				}

				const row = await sb.Query.getRow("data", "Custom_Command_Alias");
				await row.load(oldAlias.ID);
				row.values.Name = newAliasName;

				await row.save({ skipLoad: true });
				return {
					reply: `Your alias "${oldAliasName}" has been successfully renamed to "${newAliasName}".`
				};
			}

			case "run":
			case "try": {
				let name;
				let user;

				const runArgs = [...args];
				const [firstArg, secondArg] = runArgs;
				if (!firstArg) {
					return {
						success: false,
						reply: "No input provided!"
					};
				}

				if (type === "run") {
					name = firstArg;
					user = context.user;
				}
				else if (type === "try") {
					if (!secondArg) {
						return {
							success: false,
							reply: `You didn't provide an alias to try!`
						};
					}

					runArgs.splice(0, 1);
					name = secondArg;
					user = await sb.User.get(firstArg);
					if (!user) {
						return {
							success: false,
							reply: `Provided user does not exist!`
						};
					}
				}

				const eligibleAliases = await sb.Query.getRecordset(rs => rs
					.select("ID", "User_Alias", "Channel", "Command", "Invocation", "Arguments", "Parent")
					.from("data", "Custom_Command_Alias")
					.where({ condition: !context.channel }, "User_Alias = %n", user.ID)
					.where({ condition: Boolean(context.channel) }, "User_Alias = %n OR Channel = %n", user.ID, context.channel?.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
				);

				let alias;
				if (eligibleAliases.length <= 1) {
					alias = eligibleAliases[0];
				}
				else {
					alias = eligibleAliases.find(i => i.User_Alias === user.ID) ?? eligibleAliases.find(i => i.Channel === context.channel?.ID);
				}

				if (!alias) {
					if (!this.staticData.nameCheck.regex.test(name)) {
						return {
							success: false,
							reply: null
						};
					}

					const who = (user === context.user) ? "You" : "They";
					return {
						success: false,
						reply: `${who} don't have the "${name}" alias!`
					};
				}
				else if (alias.Command === null && alias.Parent !== null) {
					alias = await sb.Query.getRecordset(rs => rs
						.select("User_Alias", "Command", "Invocation", "Arguments", "Parent")
						.from("data", "Custom_Command_Alias")
						.where("ID = %n", alias.Parent)
						.limit(1)
						.single()
					);

					// When running a linked alias, make sure to actually use the link owner's data -
					// as if using $alias try (user) (linked alias)
					type = "try";
					user = await sb.User.get(alias.User_Alias);
				}
				else if (alias.Command === null && alias.Parent === null) {
					return {
						success: false,
						reply: `You tried to ${type} a linked alias, but the original has been deleted!`
					};
				}

				let invocation = alias.Invocation;
				const aliasArguments = (alias.Arguments) ? JSON.parse(alias.Arguments) : [];

				const { success, reply, resultArguments } = this.staticData.applyParameters(context, aliasArguments, runArgs.slice(1));
				if (!success) {
					return { success, reply };
				}

				const commandData = sb.Command.get(invocation);
				if (!commandData) {
					return {
						success: false,
						reply: `Your alias contains the command ${invocation} which has been archived, retired, or removed!`
					};
				}
				else if (context.append.pipe && !commandData.Flags.pipe) {
					return {
						success: false,
						reply: `Cannot use the ${invocation} command inside of a pipe, despite being wrapped in an alias!`
					};
				}

				// If the invocation is `$alias try (user) (alias)`, and the invoked alias contains another alias
				// execution, replace the sub-alias from `$alias run` (or `$$`) to `$alias try`, so that the user
				// who is trying the alias does not need to care about dependencies.
				const aliasTry = {};
				if (type === "try") {
					aliasTry.userName = user.Name;

					if (invocation === "$" && commandData === this) {
						invocation = "alias";
						resultArguments.unshift("try", user.Name);
					}
					else if (resultArguments[0] === "run" && commandData === this) {
						resultArguments[0] = "try";
						resultArguments.splice(1, 0, user.Name);
					}
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
						aliasArgs: Object.freeze(runArgs.slice(1)),
						aliasCount,
						aliasStack: [...(context.append.aliasStack ?? []), name],
						aliasTry,
						platform: context.platform,
						skipBanphrases: true,
						skipMention: true,
						skipPending: true,
						partialExecute: true,
						tee: context.tee
					}
				);

				return {
					...result,
					cooldown: (context.append.pipe) ? null : this.Cooldown,
					hasExternalInput: Boolean(result?.hasExternalInput ?? commandData.Flags.externalInput)
				};
			}
		}

		return {
			success: false,
			reply: sb.Utils.tag.trim `
				Invalid sub-command provided!
				Check the extended help here:
				${this.getDetailURL()}
			`
		};
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

		`<code>${prefix}alias try (user) (alias) (...arguments)</code>`,
		"Runs another user's alias, without needing to copy it from them first.",
		"",

		`<code>${prefix}alias copy (username) (alias)</code>`,
		`<code>${prefix}alias copyplace (username) (alias)</code>`,
		"Takes someone else's alias, and attempts to copy it with the same name for you.",
		"If you use <code>copy</code>, it will only create an alias if you don't already have one with that name.",
		"If you use <code>copyplace</code>, it will replace whatever alias you have with that name without asking.",
		"",

		`<code>${prefix}alias link (username) (alias)</code>`,
		"Takes someone else's alias, and creates a link of it for you, with the same name.",
		"A link simply executes the user's alias, without you needing to specify it.",
		"If the original link changes, then so will the execution of your link - as it is the same alias, really.",
		"If the original is deleted, then your link will become invalid.",
		"This is recommended to use with reputable alias creators, or if you actually trust someone with their alias and the changes.",
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

		`<code>${prefix}alias publish (username) alias</code>`,
		`<code>${prefix}alias unpublish (username) (alias)</code>`,
		"Channel owners and ambassadors are able to \"publish\" an existing alias in the channel they're authorized in.",
		"An alias being published means that anyone in that channel will be able to use it as if they had made it.",
		"Naturally, if a user has their own alias with the same name, that one will be used first.",
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
					<code>\${-#}</code> (e.g. \${-1}, \${-3}, ...)
					<br>
					Replaced by argument on position #, from the end of the list. As in, -3 = third from the end.
					<br>
					<code>${prefix}alias add test translate to:\${-1} hello!</code>
					<br>
					<code>${prefix}alias run test hello 1 2 3 4 spanish</code> => <code>${prefix}translate to:spanish hello</code>
				</li>
				<br>
				<li>
					<code>\${#+}</code> (e.g. \${0+}, \${1+}, but also \${-2+}, \${-5+} ...)
					<br>
					Replaced by argument number # and all the following arguments in your alias execution.
					If the number is negative, it determines the number as from the end of the list, then takes the rest until the end.
					<br>
					<code>${prefix}alias add test translate to:\${0} hello, \${1+}!</code>
					<br>
					<code>${prefix}alias run test spanish my friends</code> => <code>${prefix}translate to:spanish hello, my friends!</code>
				</li>
				<br>
				<li>
					<code>\${#-#}</code> (e.g. \${0..1}, \${1..10}, but also \${-3..-2}, \${1..-1}, ...)
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
			</ul>`,

		`For a list of neat small commands usable within aliases to ease up your work, check the <a href="/bot/command/detail/aliasbuildingblock">${prefix}aliasbuildingblock</a> command.`,
		"This command lets you build up aliases without needing to create small aliases of your own for menial tasks.",
		"A good example is <code>$abb say</code>, which simply returns its input - so you don't have to create an alias that does that for you."
	])
};
