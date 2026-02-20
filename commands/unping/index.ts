import { handleGenericFilter, parseGenericFilterOptions } from "../../utils/command-utils.js";
import { Filter } from "../../classes/filter.js";
import { declare } from "../../classes/command.js";

export default declare({
	Name: "unping",
	Aliases: ["reping"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sets/unsets a command pinging you when it's being invoked.",
	Flags: ["mention"],
	Params: [
		{ name: "command", type: "string" },
		{ name: "channel", type: "string" },
		{ name: "id", type: "number" },
		{ name: "invocation", type: "string" },
		{ name: "platform", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function unping (context, ...args: string[]) {
		const parse = await parseGenericFilterOptions("Unping", context.params, args, {
			argsOrder: ["command"],
			includeUser: true
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
			enableVerb: "removed pings from",
			disableVerb: "returned pings to"
		};

		if (parse.filter instanceof Filter) {
			return await handleGenericFilter("Unping", {
				...baseOptions,
				filter: parse.filter
			});
		}

		const parseFilterData = parse.filter;
		const unpingFilters = sb.Filter.getLocals("Unping", {
			user: context.user,
			command: parseFilterData.command,
			invocation: parseFilterData.invocation,
			includeInactive: true
		});

		const unpingFilter = unpingFilters.find(i => (
			i.Channel === parseFilterData.channel
			&& i.Platform === parseFilterData.platform
			&& i.Command === parseFilterData.command
			&& i.Invocation === parseFilterData.invocation
			&& i.Blocked_User === parseFilterData.user
		));

		if (unpingFilter) {
			return await handleGenericFilter("Unping", {
				...baseOptions,
				filter: unpingFilter
			});
		}
		else {
			return await handleGenericFilter("Unping", {
				...baseOptions,
				filterData: parseFilterData
			});
		}
	}),
	Dynamic_Description: () => ([
		`Makes a specific command/channel/platform/user combination not "ping" you - the message will not be highlighted.`,
		"This is achieved by inserting an invisible character to your username, which will \"trick\" your chat program into not highlighting the message.",
		"",

		`<code>$unping (command)</code>`,
		`Makes the given command not ping you anymore.`,
		"",

		`<code>$reping (command)</code>`,
		`Returns the ping from a given command.`,
		"",

		`<code>$unping all</code>`,
		`<code>$reping all</code>`,
		"Removes (or adds back) pinging of your username from all current and future commands.",
		"NOTE: <u>This command will not remove pings from each command separately!</u> It simply applies a single setting that removes them from all commands, present and future.",
		"This means you can't <u>$unping all</u> and then separately <u>$unping</u> from other commands in particular.",
		"",

		`<code>unping id:(ID)</code>`,
		`<code>reping id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>unping channel:(channel name)</code>`,
		`<code>unping platform:(platform name)</code>`,
		`Removes pinging of your username for a given user/channel/command/platform combination.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>$unping command:rl channel:supibot</code>
					Will remove the ping from command rl only in channel "supibot".
				</li>				
				<li> 
					<code>$unping command:rl user:foobar</code>
					Will remove the ping from command rl only if used by user "foobar".
				</li>
				<li> 
					<code>$unping command:rl platform:twitch</code>
					Will remove the ping from command rl only in Twitch.
				</li>
				<li> 
					<code>$unping channel:supibot</code>
					Will remove the ping from opt-outable commands, only in channel "supibot".
				</li>
			</ul>`
	])
});
