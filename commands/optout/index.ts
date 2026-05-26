import { declare } from "../../classes/command.js";
import { handleGenericFilter, parseGenericFilterOptions } from "../../utils/command-utils.js";
import { Filter } from "../../classes/filter.js";

export default declare({
	Name: "optout",
	Aliases: ["unoptout"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Makes it so you cannot be the target of a command - the command will not be executed at all. For detailed usage, please check the extended help.",
	Flags: ["mention", "skip-banphrase"],
	Params: [
		{ name: "command", type: "string" },
		{ name: "channel", type: "string" },
		{ name: "id", type: "number" },
		{ name: "invocation", type: "string" },
		{ name: "platform", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function optOut (context, ...args) {
		const parse = await parseGenericFilterOptions("Opt-out", context.params, args, {
			argsOrder: ["command"],
			requiredCommandFlag: "opt-out",
			requiredCommandFlagResponse: "You cannot opt out from this command!"
		});

		if (!parse.success) {
			return parse;
		}

		const baseOptions = {
			context,
			filter: null,
			filterData: null,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			enableVerb: "opted out from",
			disableVerb: "removed your opt-out from"
		};

		if (parse.filter instanceof Filter) {
			return await handleGenericFilter("Opt-out", {
				...baseOptions,
				filter: parse.filter
			});
		}

		const parseFilterData = parse.filter;
		const optOutFilters = sb.Filter.getLocals("Opt-out", {
			user: context.user,
			command: parseFilterData.command,
			invocation: parseFilterData.invocation,
			includeInactive: true
		});

		const optoutFilter = optOutFilters.find(i => (
			i.Channel === parseFilterData.channel
			&& i.Platform === parseFilterData.platform
			&& i.Command === parseFilterData.command
			&& i.Invocation === parseFilterData.invocation
		));

		if (optoutFilter) {
			return await handleGenericFilter("Opt-out", {
				...baseOptions,
				filter: optoutFilter
			});
		}
		else {
			return await handleGenericFilter("Opt-out", {
				...baseOptions,
				filterData: parseFilterData
			});
		}
	}),
	Dynamic_Description: (prefix) => ([
		"Opts you out of a specific command.",
		"While opted out from command, nobody can use it with you as the parameter.",
		"",

		`<code>${prefix}optout (command)</code>`,
		`<code>${prefix}optout randomline</code>`,
		`<code>${prefix}optout command:(command)</code>`,
		`<code>${prefix}optout command:randomline</code>`,
		`Will opt you out from a given command.`,
		"",

		`<code>${prefix}optout (command alias)</code>`,
		`<code>${prefix}optout rl</code>`,
		`<code>${prefix}optout command:(command alias)</code>`,
		`<code>${prefix}optout command:rl</code>`,
		`You can also opt-out from a specific alias of a given command. Watch out! This will only apply to that certain alias.`,
		`E.g. optint out from "rl" will opt you out from <code>${prefix}rl</code>, but not from <code>${prefix}randomline</code>.`,
		"This is useful if the command has multiple aliases that do something different, like <code>tuck</code> vs. <code>hug</code> and others.",
		"",

		`<code>${prefix}optout all</code>`,
		`<code>${prefix}optout command:all</code>`,
		`Will opt you out from all current and future opt-outable commands, everywhere.`,
		"NOTE: <u>This command will not opt you out from each command separately!</u> It simply applies a single setting that opts you out from all commands, present and future.",
		"This means you can't <u>$optout all</u> and then separately <u>$unoptout</u> from some commands in particular.",
		"",

		`<code>${prefix}unoptout (command)</code>`,
		`<code>${prefix}unoptout all</code>`,
		"To reverse an opt-out, simply use the <code>unoptout</code> command with the same parameters you used previously.",
		"",

		`<code>${prefix}optout id:(ID)</code>`,
		`<code>${prefix}unoptout id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>${prefix}optout channel:(channel name)</code>`,
		`<code>${prefix}optout platform:(platform name)</code>`,
		`Will opt you out from a specified combination of command(s) and a channel/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>${prefix}optout rl channel:supibot</code>
					Will opt you out from command rl only in channel "supibot".
				</li>
				<li> 
					<code>${prefix}optout command:rl platform:twitch</code>
					Will opt you out from command rl only in Twitch.
				</li>
				<li> 
					<code>${prefix}optout command:all channel:supibot</code>
					Will opt you out from all opt-outable commands, only in channel "supibot".
				</li>
			</ul>`,
		""
	])
});
