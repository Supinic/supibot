const { handleGenericFilter, parseGenericFilterOptions } = require("../../utils/command-utils.js");

module.exports = {
	Name: "unmention",
	Aliases: ["remention"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Makes a specific command (or, in advanced mode, a combination of command/channel/platform, or global) not mention you by removing the \"username,\" part at the beginning.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function unmention (context, ...args) {
		let filter;
		let filterData;
		const parse = await parseGenericFilterOptions(context.params, args);
		if (!parse.success) {
			return parse;
		}
		else if (parse.filter) {
			filter = parse.filter;
		}
		else {
			filterData = parse.filterData;
			filter = sb.Filter.data.find(i => (
				i.Type === "Unmention"
				&& i.Channel === filterData.channel
				&& i.Command === filterData.command
				&& i.Platform === filterData.platform
				&& i.Invocation === filterData.invocation
				&& i.User_Alias === context.user.ID
			));
		}

		return await handleGenericFilter("Unping", {
			context,
			filter,
			filterData,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			pastVerb: "removed mentions"
		});
	}),
	Dynamic_Description: (async (prefix) => [
		`Removes, or adds back, the "mention" of a specific command.`,
		`A mention is basically the "user," part at the start of the command response.`,
		"While unmentioned, the command(s) will not add this part.",
		"",

		`<code><u>Simple mode</u></code>`,
		`<code>${prefix}unmention (command)</code>`,
		`Will remove the mention from a given command`,
		"",

		`<code>${prefix}remention (command)</code>`,
		`Will put the mention back in a given command`,
		"",

		`<code><u>Total mode</u></code>`,
		`<code>${prefix}unmention all</code>`,
		`Will remove all mentions from all current and future commands that support unmentioning, everywhere.`,
		"Currently, there is no way to combine a global unmention with command-specific ones.",
		"E.g. you can't unmention all, and then decide to remention from one command. Support for this might come in the future, though.",
		"",

		`<code><u>Advanced mode</u></code>`,
		`<code>${prefix}unmention channel:(chn) command:(cmd) platform:(p)</code>`,
		`Will remove the mention(s) from a specified combination of channel/command/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>${prefix}unmention command:rl channel:supibot</code>
					Will remove the mention from command rl only in channel "supibot".
				</li>
				<li> 
					<code>${prefix}unmention command:rl platform:twitch</code>
					Will remove the mention from command rl only in Twitch.
				</li>
				<li> 
					<code>${prefix}unmention channel:supibot</code>
					Will remove the mention from opt-outable commands, only in channel "supibot".
				</li>
			</ul>`
	])
};
