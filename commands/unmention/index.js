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
		const { invocation } = context;
		if (args.length === 0) {
			return {
				success: false,
				reply: `You must provide something to ${invocation} from! Check the command's help if needed.`
			};
		}
	
		let deliberateGlobalUnmention = false;
		const types = ["command", "platform", "channel"];
		const names = {};
		const filterData = {
			command: null,
			platform: null,
			channel: null
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
			deliberateGlobalUnmention = true;
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
			else {
				if (module === sb.Command && !specificData.Flags.mention) {
					return {
						success: false,
						reply: `That command doesn't mention anyone in the first place, so you can't change that for yourself!`
					};
				}
	
				names[type] = specificData.Name;
				filterData[type] = specificData.ID;
			}
		}
	
		if (!deliberateGlobalUnmention && filterData.command === null) {
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
			i.Type === "Unmention"
			&& i.Channel === filterData.channel
			&& i.Command === filterData.command
			&& i.Platform === filterData.platform
			&& i.User_Alias === context.user.ID
		));
	
		if (filter) {
			if ((filter.Active && invocation === "unmention") || (!filter.Active && invocation === "remention")) {
				return {
					success: false,
					reply: `You already used this command on this combination!`
				};
			}
	
			const suffix = (filter.Active) ? "" : " again";
			await filter.toggle();
	
			return {
				reply: `Succesfully ${invocation}ed${suffix}!`
			}
		}
		else {
			if (invocation === "remention") {
				return {
					success: false,
					reply: "You haven't made this command not mention you yet!"
				};
			}
	
			const filter = await sb.Filter.create({
				Active: true,
				Type: "Unmention",
				User_Alias: context.user.ID,
				Command: filterData.command,
				Channel: filterData.channel,
				Platform: filterData.platform,
				Issued_By: context.user.ID
			});
	
			const commandPrefix = sb.Config.get("COMMAND_PREFIX");
			let commandString = `the command ${commandPrefix}${names.command}`;
	
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
					You made ${commandString} not mention you
					${location}
					(ID ${filter.ID}).
				`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
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
			</ul>`,
		];
	})
};