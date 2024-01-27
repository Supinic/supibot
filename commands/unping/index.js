const { handleGenericFilter, parseGenericFilterOptions } = require("../../utils/command-utils.js");

module.exports = {
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
	Static_Data: null,
	Code: (async function unping (context, ...args) {
		let filter;
		let filterData;
		const parse = await parseGenericFilterOptions("Unping", context.params, args, {
			argsOrder: ["command"],
			includeUser: true
		});

		if (!parse.success) {
			return parse;
		}
		else if (parse.filter) {
			filter = parse.filter;
		}
		else {
			filterData = parse.filterData;
			filter = sb.Filter.data.find(i => (
				i.Type === "Unping"
				&& i.Channel === filterData.channel
				&& i.Command === filterData.command
				&& i.Platform === filterData.platform
				&& i.Invocation === filterData.invocation
				&& i.Blocked_User === filterData.user
				&& i.User_Alias === context.user.ID
			));
		}

		return await handleGenericFilter("Unping", {
			context,
			filter,
			filterData,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			enableVerb: "removed pings from",
			disableVerb: "returned pings to"
		});
	}),
	Dynamic_Description: (async () => [
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
};
