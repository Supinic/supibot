import { declare, type SubcommandDefinition } from "../../classes/command.js";

export type AliasSubcommandDefinition = SubcommandDefinition<typeof aliasCommandDefinition>;
import config from "../../config.json" with { type: "json" };
export const { prefix } = config.modules.commands;

const aliasCommandDefinition = declare({
	Name: "alias",
	Aliases: ["$"],
	Cooldown: 2500,
	Description: "This command lets you create your own aliases (shorthands) for any other combination of commands and arguments. Check the extended help for step-by-step info.",
	Flags: ["external-input","mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function alias (context, type, ...args) {
		if (context.invocation === "$") {
			args = [type, ...args]; // This the command name
			type = "run"; // This is the implicit subcommand
		}

		if (!type) {
			return {
				reply: core.Utils.tag.trim `
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
			case "duplicate": {
				const [oldAliasName, newAliasName] = args;
				if (!oldAliasName || !newAliasName) {
					return {
						reply: `To duplicate an alias, you must provide both existing and new alias names!`
					};
				}
				else if (!ALIAS_NAME_REGEX.test(newAliasName)) {
					return {
						success: false,
						reply: `Your alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
					};
				}

				const oldAlias = await core.Query.getRecordset(rs => rs
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

				const newAlias = await core.Query.getRecordset(rs => rs
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

				const row = await core.Query.getRow("data", "Custom_Command_Alias");
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

			case "link":
			case "linkplace": {
				const [userName, aliasName, customLinkName] = args;
				if (!userName || !aliasName) {
					return {
						success: false,
						reply: `You didn't provide a user, or the alias name! Use: alias link (user) (alias name)`
					};
				}

				const name = customLinkName ?? aliasName;
				const existingID = await core.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", context.user.ID)
					.where("Name COLLATE utf8mb4_bin = %s", name)
					.single()
					.flat("ID")
					.limit(1)
				);
				if (existingID && type !== "linkplace") {
					return {
						success: false,
						reply: `Cannot link a new alias - you already have an alias with this name!`
					};
				}

				const targetUserData = await sb.User.get(userName);
				if (!targetUserData) {
					return {
						success: false,
						reply: `Provided user does not exist!`
					};
				}

				let targetAlias = await core.Query.getRecordset(rs => rs
					.select("ID", "Name", "Description", "Command", "Parent", "Restrictions")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", targetUserData.ID)
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
				else if (context.user !== targetUserData && AliasUtils.isRestricted("link", targetAlias)) {
					return {
						success: false,
						reply: `You cannot link this alias! Its creator has prevented new links from being created.`
					};
				}

				else if (targetAlias.Command === null && targetAlias.Parent !== null) {
					// If attempting to link an already linked alias, change the pointer to the original alias
					targetAlias = await core.Query.getRecordset(rs => rs
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
				else if (!ALIAS_NAME_REGEX.test(targetAlias.Name)) {
					return {
						success: false,
						reply: `Linked alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
					};
				}

				const row = await core.Query.getRow("data", "Custom_Command_Alias");
				if (existingID) {
					if (type !== "linkplace") {
						throw new sb.Error({
							message: "Sanity check - reached linkplace without $alias linkplace"
						});
					}

					await row.load(existingID);
				}

				row.setValues({
					User_Alias: context.user.ID,
					Channel: null,
					Name: name,
					Command: null,
					Invocation: null,
					Arguments: null,
					Created: new sb.Date(),
					Edited: null,
					Description: targetAlias.Description,
					Parent: targetAlias.ID
				});

				await row.save({ skipLoad: true });

				const verb = (type === "linkplace") ? "linked and replaced" : "linked";
				const nameString = (customLinkName && customLinkName !== targetAlias.Name)
					? `, with a custom name "${customLinkName}"`
					: "";

				return {
					reply: `Successfully ${verb} alias${nameString}. When the original changes, so will yours. ${appendix}`
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

				const alias = await core.Query.getRecordset(rs => rs
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

				let publishString = "";
				const publishedIDs = await core.Query.getRecordset(rs => rs
					.select("ID")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NOT NULL")
					.where("Parent = %n", alias.ID)
					.flat("ID")
				);

				if (publishedIDs.length !== 0) {
					await core.Query.getRecordDeleter(rd => rd
						.delete()
						.from("data", "Custom_Command_Alias")
						.where("ID IN %n+", publishedIDs)
						.where("Channel IS NOT NULL")
						.where("Parent = %n", alias.ID)
					);

					publishString = ` It was also published in ${publishedIDs.length} channels - these have also been removed.`;
				}

				const row = await core.Query.getRow("data", "Custom_Command_Alias");
				await row.load(alias.ID);

				await row.delete();
				return {
					success: false,
					reply: `Your alias "${name}" has been successfully removed.${publishString}`
				};
			}
		}

		return {
			success: false,
			reply: core.Utils.tag.trim `
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
		`An alias is a word that lets you quickly use a command without typing the entirety of it.`,
		`E.g.: You don't want to type <code>${prefix}weather New York, USA</code> every time, so you create an alias called <code>ny</code>.`,
		`Then, you can simply use the alias like so: <code>${prefix}$ ny</code>`,
		"",

		`<h5>Usage</h5>`,
		"",

		`<code>${prefix}alias link (username) (alias)</code>`,
		`<code>${prefix}alias link (username) (alias) (custom name)</code>`,
		`<code>${prefix}alias linkplace (username) (alias)</code>`,
		`<code>${prefix}alias linkplace (username) (alias) (custom name)</code>`,
		"Takes someone else's alias, and creates a link of it for you, with the same name.",
		"A link simply executes the user's alias, without you needing to specify it.",
		"If the original link changes, then so will the execution of your link - as it is the same alias, really.",
		"If the original is deleted, then your link will become invalid.",
		"This is recommended to use with reputable alias creators, or if you actually trust someone with their alias and the changes.",
		"You can also rename the link immediately by providing your own custom alias name at the end of the command.",
		"If you use <code>linkplace</code>, the command will replace any alias with the same name that you might already have.",
		"",

		`<code>${prefix}alias link (username) (alias) (custom name)</code>`,
		"Takes someone else's alias, and creates a link of it for you, with your own custom name for it.",
		"This can also be used to create links to your own aliases - essentially creating aliases of your own aliases 😅",
		"",

		`<code>${prefix}alias check</code>`,
		`<code>${prefix}alias spy</code>`,
		`<code>${prefix}alias code</code>`,
		`<code>${prefix}alias show</code>`,
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


		`<code>${prefix}alias addedit (name) (definition)</code>`,
		`<code>${prefix}alias upsert (name) (definition)</code>`,
		`Creates a new alias, or updates an existing alias of your own. If you replace an existing one, you will lose its definition`,
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
});

export default aliasCommandDefinition;
