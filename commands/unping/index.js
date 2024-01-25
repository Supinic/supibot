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
		const parse = await parseGenericFilterOptions(context.params, args, { includeUser: true });
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
			pastVerb: "removed pings"
		});
	}),
	Dynamic_Description: (async (prefix) => [
		`Makes a specific command/channel/platform/user combination not "ping" you - the message will not be highlighted.`,
		"",

		`<code><u>Simple mode</u></code>`,
		`<code>${prefix}unping (command)</code>`,
		`Makes the given command not ping you anymore.`,
		"",

		`<code>${prefix}reping (command)</code>`,
		`Returns the ping from a given command.`,
		"",

		`<code><u>Total mode</u></code>`,
		`<code>${prefix}unping all</code>`,
		`<code>${prefix}reping all</code>`,
		"Removes (or adds back) pinging of your username from all current and future commands.",
		"",

		`<code><u>Advanced mode</u></code>`,
		`<code>${prefix}unping channel:(channel) user:(username) command:(command) platform:(platform)</code>`,
		`Removes pinging of your username for a given user/channel/command/platform combination.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>${prefix}unping command:rl channel:supibot</code>
					Will remove the ping from command rl only in channel "supibot".
				</li>				
				<li> 
					<code>${prefix}unping command:rl user:foobar</code>
					Will remove the ping from command rl only if used by user "foobar".
				</li>
				<li> 
					<code>${prefix}unping command:rl platform:twitch</code>
					Will remove the ping from command rl only in Twitch.
				</li>
				<li> 
					<code>${prefix}unping channel:supibot</code>
					Will remove the ping from opt-outable commands, only in channel "supibot".
				</li>
			</ul>`
	])
};
