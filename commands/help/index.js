module.exports = {
	Name: "help",
	Aliases: ["commands","helpgrep"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts either: a short list of all commands, or a description of a specific command if you specify it.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function help (context, ...args) {
		const prefix = sb.Config.get("COMMAND_PREFIX");
		const [commandString] = args;

		// No specified command - print all available commands in given channel for given user
		if (!commandString || context.invocation === "commands") {
			return {
				reply: (!context.channel || context.channel.Links_Allowed)
					? "Commands available here: https://supinic.com/bot/command/list - Also check the FAQ here: https://supinic.com/data/faq/list"
					: "For the command and FAQ list, check out the Supibot tab on supinic dot com."
			};
		}
		else if (context.invocation === "helpgrep") {
			const query = args.join(" ");
			const eligible = sb.Command.data.filter(command => command.Name.includes(query)
				|| command.Aliases.some(i => i.includes(query))
				|| command.Description?.includes(query)
			);

			return {
				success: (eligible.length !== 0),
				reply: (eligible.length === 0)
					? "No matching commands found!"
					: `Matching commands: ${eligible.map(i => i.Name).join(", ")}`
			};
		}
		// Print specific command description
		else {
			const identifier = (sb.Command.is(commandString))
				? commandString.replace(sb.Command.prefix)
				: commandString;

			if (identifier.toLowerCase() === "me") {
				return {
					reply: "I can't directly help you, but maybe if you use one of my commands, you'll feel better? :)"
				};
			}

			const command = sb.Command.get(identifier);
			if (!command) {
				return {
					reply: "That command does not exist!"
				};
			}

			const filteredResponse = (command.Flags.whitelist) ? "(whitelisted)" : "";
			const aliases = (command.Aliases.length === 0) ? "" : (` (${command.Aliases.map(i => prefix + i).join(", ")})`);

			const cooldownString = `${sb.Utils.round(command.Cooldown / 1000, 1)} seconds cooldown.`;
			const cooldownModifier = sb.Filter.getCooldownModifiers({
				command,
				invocation: context.invocation,
				platform: context.platform,
				channel: context.channel ?? null,
				user: context.user
			});

			let modifierString = "";
			if (cooldownModifier) {
				const type = (cooldownModifier.Data.multiplier) ? "multiplier" : "override";
				const modified = sb.Utils.round(cooldownModifier.applyData(command.Cooldown) / 1000, 1);

				modifierString = `(you have a cooldown ${type} active - ${modified} seconds cooldown)`;
			}

			return {
				reply: sb.Utils.tag.trim `
					${prefix}${command.Name}${aliases}:
					${command.Description ?? "(no description)"}
					-
					${cooldownString}
					${modifierString}
					${filteredResponse}
					https://supinic.com/bot/command/${command.ID}
				`
			};
		}
	}),
	Dynamic_Description: null
};
