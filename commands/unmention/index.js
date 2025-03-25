import { handleGenericFilter, parseGenericFilterOptions } from "../../utils/command-utils.js";

export default {
	Name: "unmention",
	Aliases: ["remention"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Makes a specific command (or, in advanced mode, a combination of command/channel/platform, or global) not mention you by removing the \"username,\" part at the beginning.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function unmention (context, ...args) {
		let filter;
		let filterData;
		const parse = await parseGenericFilterOptions("Unmention", context.params, args, {
			argsOrder: ["command"]
		});

		if (!parse.success) {
			return parse;
		}
		else if (parse.filter) {
			filter = parse.filter;
		}
		else {
			filterData = parse.filterData;

			const unmentionFilters = sb.Filter.getLocals("Unmention", {
				user: context.User,
				command: filterData.command,
				invocation: filterData.invocation
			});

			filter = unmentionFilters.find(i => (
				i.Channel === filterData.channel
				&& i.Platform === filterData.platform
			));
		}

		return await handleGenericFilter("Unmention", {
			context,
			filter,
			filterData,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			enableVerb: "removed mentions from",
			disableVerb: "returned mentions to"
		});
	}),
	Dynamic_Description: (async () => [
		`Removes the "mention" of a specific command.`,
		`A mention is simply the "user," part at the start of the command response. E.g.:`,
		`<u>supinic,</u> Your roll is 99.`,
		"",

		`<code>$unmention (command)</code>`,
		`Removes the mention from a given command.`,
		"",

		`<code>$remention (command)</code>`,
		`Returns the mention back in a given command.`,
		"",

		`<code>$unmention all</code>`,
		`Removes all mentions from all current and future commands that support unmentioning, everywhere.`,
		"NOTE: <u>This command will not remove mentions from each command separately!</u> It simply applies a single setting that removes them from all commands, present and future.",
		"This means you can't <u>$unmention all</u> and then separately <u>$unmention</u> from other commands in particular.",
		"",

		`<code>$unmention id:(ID)</code>`,
		`<code>$remention id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>$unmention channel:(channel name)</code>`,
		`<code>$unmention platform:(platform name)</code>`,
		`Will remove the mention(s) from a specified combination of channel/command/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>$unmention command:rl channel:supibot</code>
					Will remove the mention from command rl only in channel "supibot".
				</li>
				<li> 
					<code>$unmention command:rl platform:twitch</code>
					Will remove the mention from command rl only in Twitch.
				</li>
				<li> 
					<code>$unmention channel:supibot</code>
					Will remove the mention from opt-outable commands, only in channel "supibot".
				</li>
			</ul>`
	])
};
