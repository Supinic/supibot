const { handleGenericFilter, parseGenericFilterOptions } = require("../../utils/command-utils.js");

module.exports = {
	Name: "block",
	Aliases: ["unblock"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Blocks, or unblocks a specified user from using a specified command with you as the target. You can also set a channel, or platform for the block to be active on.",
	Flags: ["mention"],
	Params: [
		{ name: "channel", type: "string" },
		{ name: "command", type: "string" },
		{ name: "id", type: "number" },
		{ name: "platform", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: ["user", "command", "platform", "channel"]
	})),
	Code: (async function block (context, ...args) {
		let filter;
		let filterData;
		const parse = await parseGenericFilterOptions(context.params, args, {
			argsOrder: ["user", "command"],
			checkCommandBlocks: true,
			includeUser: true
		});

		let blockedUserData;
		if (!parse.success) {
			return parse;
		}
		else if (parse.filter) {
			filter = parse.filter;
			blockedUserData = await sb.User.get(filter.Blocked_User);
		}
		else {
			filterData = parse.filterData;

			if (!filterData.user) {
				return {
					success: false,
					reply: `You must provide someone to block!`
				};
			}
			else if (filterData.user === context.platform.Self_ID) {
				const emote = await context.randomEmote("monkaStare", "supiniStare", "😬🫵");
				return {
					success: false,
					reply: `I wouldn't try that! ${emote}`
				};
			}

			blockedUserData = await sb.User.get(filterData.user);

			filter = sb.Filter.data.find(i => (
				i.Type === "Block"
				&& i.Blocked_User === filterData.user
				&& i.Channel === filterData.channel
				&& i.Command === filterData.command
				&& i.Platform === filterData.platform
				&& i.User_Alias === context.user.ID
			));
		}

		return await handleGenericFilter("Unping", {
			context,
			filter,
			filterData,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			enableVerb: `blocked ${blockedUserData.Name} from`,
			disableVerb: `unblocked ${blockedUserData.Name} from`
		});
	}),
	Dynamic_Description: (async () => [
		"Blocks a specified user from using the specified command with you as the parameter",
		"",

		`<code>$block (user) (command)</code>`,
		`<code>$block user:(user) command:(command)</code>`,
		`<code>$block Kappa rl</code>`,
		`<code>$block user:Kappa command:rl</code>`,
		`Blocks the user Kappa from using the command rl on you. Then, they can't do <code>$rl (your name)</code>`,
		"",

		`<code>$unblock (user) (command)</code>`,
		`Unblocks the user from a given command.`,
		"",

		`<code>$block (user) all</code>`,
		`<code>$block user:(user) command:all</code>`,
		`Blocks provided user from all current and future commands that support blocking people.`,
		"NOTE: <u>This command will not block the user from each command separately!</u> It simply applies a single setting that blocks them from all blockable commands, present and future.",
		"This means you can't <u>$block (user) all</u> and then separately <u>$unblock (user)</u> from other commands in particular.",
		"",

		`<code>$block id:(ID)</code>`,
		`<code>$unblock id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>$block user:(usr) channel:(chn) command:(cmd) platform:(p)</code>`,
		`Will block given user from a specified combination of channel/command/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>$block command:rl user:Kappa channel:supibot</code>
					<br>
					Blocks user Kappa from command rl only in channel "supibot".
				</li>
				<li> 
					<code>$block command:rl user:Kappa platform:twitch</code>
					<br>
					Blocks user Kappa from command rl, but only on Twitch.
				</li>
				<li> 
					<code>$block user:Kappa channel:supibot</code>
					<br>
					Blocks Kappa from all blockable commands, but only in channel "supibot".
				</li>
			</ul>`
	])
};
