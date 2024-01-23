module.exports = {
	Name: "optout",
	Aliases: ["unoptout"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Makes it so you cannot be the target of a command - the command will not be executed at all. For detailed usage, please check the extended help.",
	Flags: ["mention","skip-banphrase"],
	Params: [
		{ name: "command", type: "string" },
		{ name: "channel", type: "string" },
		{ name: "id", type: "number" },
		{ name: "invocation", type: "string" },
		{ name: "platform", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function optOut (context, commandInput) {
		const { invocation, params } = context;

		let filter;
		const filterData = {};

		if (params.id) {
			filter = sb.Filter.get(params.id);

			if (!filter) {
				return {
					success: false,
					reply: `There is no filter with ID ${params.id}!`
				};
			}
		}
		else {
			const commandName = params.command ?? commandInput;
			if (!commandName) {
				return {
					success: false,
					reply: `A command (or "all" to optout globally) must be provided!`
				};
			}

			if (commandName === "all") {
				filterData.command = null;
			}
			else {
				const commandData = sb.Command.get(commandName);
				if (!commandData) {
					return {
						success: false,
						reply: `Command ${commandName} does not exist!`
					};
				}

				filterData.command = commandData.Name;

				// Apply a "heuristic" - if user provided an alias to a command, automatically assume
				// it's the base command + the alias as invocation
				if (commandData.Name !== commandName) {
					filterData.invocation = commandName;
				}
			}

			if (params.channel && params.platform) {
				return {
					success: false,
					reply: "Cannot specify both the channel and platform!"
				};
			}

			if (params.channel) {
				const channelData = sb.Channel.get(params.channel);
				if (!channelData) {
					return {
						success: false,
						reply: `Channel ${params.channel} does not exist!`
					};
				}

				filterData.channel = channelData.ID;
			}

			if (params.platform) {
				const platformData = sb.Platform.get(params.platform);
				if (!platformData) {
					return {
						success: false,
						reply: `Platform ${params.platform} does not exist!`
					};
				}

				filterData.platform = platformData.ID;
			}

			filter = sb.Filter.data.find(i => (
				i.Type === "Opt-out"
				&& i.Command === filterData.command
				&& i.Invocation === filterData.invocation
				&& i.Channel === filterData.channel
				&& i.Platform === filterData.platform
				&& i.User_Alias === context.user.ID
			));
		}

		let replyFn;
		if (filter) {
			if (filter.Issued_By !== context.user.ID) {
				return {
					success: false,
					reply: "This command filter has not been created by you, so you cannot modify it!"
				};
			}
			else if ((filter.Active && invocation === "optout") || (!filter.Active && invocation === "unoptout")) {
				return {
					success: false,
					reply: `You are already ${invocation}ed from that combination!`
				};
			}

			const suffix = (filter.Active) ? "" : " again";
			await filter.toggle();

			replyFn = (commandString) => `Successfully ${invocation}ed${suffix} from ${commandString} (ID ${filter.ID}).`;
		}
		else {
			if (invocation === "unoptout") {
				return {
					success: false,
					reply: "You haven't opted out from this combination yet, so it cannot be reversed!"
				};
			}

			filter = await sb.Filter.create({
				Active: true,
				Type: "Opt-out",
				User_Alias: context.user.ID,
				Issued_By: context.user.ID,
				Command: filterData.command,
				Channel: filterData.channel,
				Platform: filterData.platform,
				Invocation: filterData.invocation
			});

			let location = "";
			if (filterData.channel) {
				location = ` in channel ${filterData.channel}`;
			}
			else if (filterData.platform) {
				location = ` in platform ${filterData.platform}`;
			}

			replyFn = (commandString) => `You opted out from ${commandString} ${location} (ID ${filter.ID}).`;
		}

		let commandString;
		const prefix = sb.Command.prefix;
		if (filter.Command === null) {
			commandString = "all opt-outable commands. This does not affect your other individual opt-outs for specific commands";
		}
		else if (filter.Invocation !== null) {
			commandString = `command ${prefix}${filter.Command} (alias ${prefix}${filter.Invocation})`;
		}
		else {
			commandString = `command ${prefix}${filter.Command}`;
		}

		const reply = replyFn(commandString);
		return { reply };
	}),
	Dynamic_Description: (async () => [
		"Opts you out of a specific command.",
		"While opted out from command, nobody can use it with you as the parameter.",
		"",

		`<code>$optout (command)</code>`,
		`<code>$optout command:(command)</code>`,
		`Will opt you out from a given command.`,
		`You can also opt-out from a concrete alias of a given command - this will only apply to that certain alias.`,
		"",

		`<code>$optout all</code>`,
		`<code>$optout command:all</code>`,
		`Will opt you out from all current and future opt-outable commands, everywhere.`,
		"NOTE: <u>This command will not opt you out from each command separately!</u> It simply applies a setting that opts you out from all commands, present and future.",
		"This means you can't <u>$optout all</u> and then separately <u>$unoptout</u> from some other commands in particular.",
		"",

		`<code>$unoptout (command)</code>`,
		`<code>$unoptout all</code>`,
		`<code>$unoptout channel:(chn) command:(cmd) platform:(p)</code>`,
		"To reverse an opt-out, simply use the <code>unoptout</code> command with the same parameters you used previously.",
		"",

		`<code>$optout id:(ID)</code>`,
		`<code>$unoptout id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>$optout channel:(channel name)</code>`,
		`<code>$optout platform:(platform name)</code>`,
		`Will opt you out from a specified combination of command(s) and a channel/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>$optout rl channel:supibot</code>
					Will opt you out from command rl only in channel "supibot".
				</li>
				<li> 
					<code>$optout command:rl platform:twitch</code>
					Will opt you out from command rl only in Twitch.
				</li>
				<li> 
					<code>$optout command:all channel:supibot</code>
					Will opt you out from all opt-outable commands, only in channel "supibot".
				</li>
			</ul>`,
		""
	])
};
