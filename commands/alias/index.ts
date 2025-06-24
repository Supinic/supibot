import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { AliasSubcommands } from "./subcommands/index.js";

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
		let subArgs: string[] = args;
		let subInvocation: string | undefined = type;

		if (context.invocation === "$" && subInvocation) {
			subArgs = [subInvocation, ...args]; // This the command name
			subInvocation = "run"; // This is the implicit subcommand
		}

		const url = this.getDetailURL();
		if (!subInvocation) {
			return {
				reply: core.Utils.tag.trim `
					This command lets you create your own command aliases.
					Check the extended help here: ${url}
					If you created some, check your list here:
					https://supinic.com/user/alias/list
				`
			};
		}

		subInvocation = subInvocation.toLowerCase();
		const subcommand = AliasSubcommands.get(subInvocation);
		if (!subcommand) {
			return {
				success: false,
				reply: core.Utils.tag.trim `Invalid sub-command provided! Check the extended help here: ${url}`
			};
		}

		return await subcommand.execute.call(this, context, subInvocation, ...subArgs);
	}),
	Dynamic_Description: (prefix) => {
		const subcommandDescriptions = AliasSubcommands.createDescription();
		return [
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

			...subcommandDescriptions,
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
		];
	}
});

export default aliasCommandDefinition;
