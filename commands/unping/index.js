module.exports = {
	Name: "unping",
	Aliases: ["reping"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sets/unsets a command pinging you when it's being invoked.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function unping (context, ...args) {
		const { invocation } = context;
		if (args.length === 0) {
			return {
				success: false,
				reply: `You must provide something to ${invocation} from! Check the command's help if needed.`
			};
		}

		let deliberateGlobalUnping = false;
		const types = ["command", "platform", "channel", "user"];
		const names = {};
		const filterData = {
			command: null,
			platform: null,
			channel: null,
			user: null
		};

		if (args.every(i => !i.includes(":"))) { // Simple mode
			[filterData.command] = args;
			args.splice(0, 1);
		}
		else { // Advanced Mode
			for (let i = args.length - 1; i >= 0; i--) {
				const token = args[i];
				const [type, value] = token.split(":");
				if (type && value && types.includes(type)) {
					filterData[type] = value;
					args.splice(i, 1);
				}
			}
		}

		if (filterData.command === "all") {
			filterData.command = null;
			deliberateGlobalUnping = true;
		}

		for (const [type, value] of Object.entries(filterData)) {
			if (value === null) {
				continue;
			}

			const module = sb[sb.Utils.capitalize(type)];
			const specificData = await module.get(value);
			if (!specificData) {
				return {
					success: false,
					reply: `Provided ${type} was not found!`
				};
			}
			else if (module === sb.Command) {
				names[type] = specificData.Name;
				filterData[type] = specificData.Name;
			}
			else {
				names[type] = specificData.Name;
				filterData[type] = specificData.ID;
			}
		}

		if (!deliberateGlobalUnping && filterData.command === null) {
			return {
				success: false,
				reply: `A command (or "all" to ${invocation} globally) must be provided!`
			};
		}
		else if (filterData.channel && filterData.platform) {
			return {
				success: false,
				reply: "Cannot specify both the channel and platform!"
			};
		}

		const filter = sb.Filter.data.find(i => (
			i.Type === "Unping"
			&& i.Channel === filterData.channel
			&& i.Command === filterData.command
			&& i.Platform === filterData.platform
			&& i.Blocked_User === filterData.user
			&& i.User_Alias === context.user.ID
		));

		if (filter) {
			if ((filter.Active && invocation === "unping") || (!filter.Active && invocation === "reping")) {
				return {
					success: false,
					reply: `You already used this command on this combination!`
				};
			}

			const suffix = (filter.Active) ? "" : " again";
			await filter.toggle();

			return {
				reply: `Successfully ${invocation}ed${suffix}!`
			};
		}
		else {
			if (invocation === "reping") {
				return {
					success: false,
					reply: "You haven't made this command not ping you yet!"
				};
			}

			const filter = await sb.Filter.create({
				Active: true,
				Type: "Unping",
				User_Alias: context.user.ID,
				Command: filterData.command,
				Channel: filterData.channel,
				Platform: filterData.platform,
				Blocked_User: filterData.user,
				Issued_By: context.user.ID
			});

			let commandString = `command ${sb.Command.prefix}${names.command}`;
			if (filterData.command === null) {
				commandString = "all commands";
			}

			let location = "";
			if (filterData.channel) {
				location = ` in channel ${names.channel}`;
			}
			else if (filterData.platform) {
				location = ` in platform ${names.platform}`;
			}

			return {
				reply: sb.Utils.tag.trim `
					You made the ${commandString} not ping you
					${location}
					(ID ${filter.ID}).
				`
			};
		}
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
					<code>${prefix}unmention command:rl channel:supibot</code>
					Will remove the mention from command rl only in channel "supibot".
				</li>				
				<li> 
					<code>${prefix}unmention command:rl user:foobar</code>
					Will remove the mention from command rl only if used by user "foobar".
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
