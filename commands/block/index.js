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
		{ name: "platform", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: ["user", "command", "platform", "channel"]
	})),
	Code: (async function block (context, user, command) {
		const { invocation } = context;
		const { types } = this.staticData;
		const values = {
			user: null,
			command: null,
			platform: null,
			channel: null
		};

		if (user && command) {
			values.user = user;
			values.command = command;
		}
		else {
			for (const type of types) {
				if (context.params[type]) {
					values[type] = context.params[type];
				}
			}
		}

		let deliberateGlobalBlock = false;
		if (values.command === "all") {
			values.command = null;
			deliberateGlobalBlock = true;
		}

		const names = {};
		const filterData = {};
		for (const [type, value] of Object.entries(values)) {
			if (value === null) {
				filterData[type] = null;
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
				if (!specificData.Flags.block) {
					return {
						success: false,
						reply: `You cannot block people from this command!`
					};
				}

				names[type] = specificData.Name;
				filterData[type] = specificData.Name;
			}
			else {
				names[type] = specificData.Name;
				filterData[type] = specificData.ID;
			}
		}

		if (!deliberateGlobalBlock && filterData.command === null) {
			return {
				success: false,
				reply: `A command (or "all" to ${invocation} globally) must be provided!`
			};
		}
		else if (!filterData.user) {
			return {
				success: false,
				reply: "The user to block must be specified!"
			};
		}
		else if (filterData.channel && filterData.platform) {
			return {
				success: false,
				reply: "Cannot specify both the channel and platform!"
			};
		}
		else if (names.user === context.platform.Self_Name) {
			return {
				success: false,
				reply: "I wouldn't try that."
			};
		}

		const filter = sb.Filter.data.find(i => (
			i.Type === "Block"
			&& i.Blocked_User === filterData.user
			&& i.Channel === filterData.channel
			&& i.Command === filterData.command
			&& i.Platform === filterData.platform
			&& i.User_Alias === context.user.ID
		));

		if (filter) {
			if (filter.Issued_By !== context.user.ID) {
				return {
					success: false,
					reply: "This command filter has not been created by you, so you cannot modify it!"
				};
			}
			else if ((filter.Active && invocation === "block") || (!filter.Active && invocation === "unblock")) {
				return {
					success: false,
					reply: `That combination is already ${invocation}ed!`
				};
			}

			const suffix = (filter.Active) ? "" : " again";
			await filter.toggle();

			return {
				reply: `Successfully ${invocation}ed${suffix}!`
			};
		}
		else {
			if (invocation === "unblock") {
				return {
					success: false,
					reply: "This combination has not been blocked yet, so it cannot be unblocked!"
				};
			}

			const filter = await sb.Filter.create({
				Type: "Block",
				User_Alias: context.user.ID,
				Blocked_User: filterData.user,
				Command: filterData.command,
				Channel: filterData.channel,
				Platform: filterData.platform,
				Issued_By: context.user.ID
			});

			let location = "";
			if (filterData.channel) {
				location = ` in channel ${names.channel}`;
			}
			else if (filterData.platform) {
				location = ` in platform ${names.platform}`;
			}

			const commandPrefix = sb.Config.get("COMMAND_PREFIX");
			let commandString = `the command ${commandPrefix}${names.command}`;
			if (filterData.command === null) {
				commandString = "all blockable commands";
			}

			return {
				reply: sb.Utils.tag.trim `
					You blocked ${names.user}
					from using ${commandString}
					on you${location}
					(ID ${filter.ID}).
				`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Blocks a specified user from using the specified command with you as the parameter",
		"",

		`<code><u>Simple mode</u></code>`,
		`<code>${prefix}block Kappa rl</code>`,
		`Blocks the user Kappa from using the command rl on you. They can't do <code>$rl (you)</code>`,
		"",

		`<code><u>Total mode</u></code>`,
		`<code>${prefix}block Kappa all</code>`,
		`Blocks user Kappa from all current and future commands that support blocking people.`,
		"",

		`<code><u>Advanced mode</u></code>`,
		`<code>${prefix}block user:(usr) channel:(chn) command:(cmd) platform:(p)</code>`,
		`Will opt you out from a specified combination of channel/command/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>${prefix}block command:rl user:Kappa channel:supibot</code>
					<br>
					Blocks user Kappa from command rl only in channel "supibot".
				</li>
				<li> 
					<code>${prefix}block command:rl user:Kappa platform:twitch</code>
					<br>
					Blocks user Kappa from command rl, but only on Twitch.
				</li>
				<li> 
					<code>${prefix}block user:Kappa channel:supibot</code>
					<br>
					Blocks Kappa from all block-able commands, but only in channel "supibot".
				</li>
			</ul>`
	])
};
