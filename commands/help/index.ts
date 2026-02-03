import { declare } from "../../classes/command.js";
import { isCooldownData } from "../../classes/filter.js";

export default declare({
	Name: "help",
	Aliases: ["commands", "helpgrep"],
	Cooldown: 5000,
	Description: "Posts either: a short list of all commands, or a description of a specific command if you specify it.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function help (context, ...args) {
		const { prefix } = sb.Command;
		const commandString = args.at(0);

		// No specified command - print all available commands in given channel for given user
		if (!commandString || context.invocation === "commands") {
			return {
				reply: (!context.channel || context.channel.Links_Allowed)
					? "Commands available here: https://supinic.com/bot/command/list - Also check the FAQ here: https://supinic.com/data/faq/list"
					: "For the command and FAQ list, check out the Supibot tab on supinic dot com."
			};
		}
		// Invocation "helpgrep" - finds matching command names or descriptions, then posts list of command names
		else if (context.invocation === "helpgrep") {
			const query = args.join(" ");
			const commands = [...sb.Command.data.values()];

			const eligible = commands.filter(command => (
				command.Name.includes(query)
				|| command.Aliases.some(i => i.includes(query))
				|| command.Description?.includes(query)
			));

			return {
				success: (eligible.length !== 0),
				reply: (eligible.length === 0)
					? "No matching commands found!"
					: `Matching commands: ${eligible.map(i => i.Name).join(", ")}`
			};
		}

		// Print specific command description
		const identifier = (sb.Command.is(commandString))
			? commandString.replace(sb.Command.prefix, "")
			: commandString;

		if (identifier.toLowerCase() === "me") {
			const emote = await context.randomEmote("Okayga", "supiniOkay", "FeelsOkayMan", "🙂");
			return {
				reply: `I can't directly help you, but perhaps if you use one of my commands, you'll feel better? ${emote}`
			};
		}

		const command = sb.Command.get(identifier);
		if (!command) {
			return {
				reply: "That command does not exist!"
			};
		}

		let filteredResponse = "";
		if (command.Flags.includes("whitelist")) {
			const whitelist = sb.Filter.getLocals("Whitelist", {
				command,
				invocation: identifier,
				platform: context.platform,
				channel: context.channel,
				user: context.user
			});

			if (whitelist.length === 0) {
				filteredResponse = "🚷 You don't have access to this command here!";
			}
		}

		const aliases = (command.Aliases.length === 0) ? "" : (` (${command.Aliases.map(i => prefix + i).join(", ")})`);
		const cooldownString = `${core.Utils.round(command.Cooldown / 1000, 1)} seconds cooldown.`;
		const cooldownModifier = sb.Filter.getCooldownModifiers({
			command,
			invocation: identifier,
			platform: context.platform,
			channel: context.channel ?? null,
			user: context.user
		});

		let modifierString = "";
		if (command.Cooldown && cooldownModifier && isCooldownData(cooldownModifier.Data)) {
			const type = (cooldownModifier.Data.multiplier) ? "multiplier" : "override";
			const modifierResult = cooldownModifier.applyData(command.Cooldown);
			if (modifierResult !== null) {
				const modified = core.Utils.round(modifierResult / 1000, 1);
				modifierString = `(cooldown ${type}: ${modified}s)`;
			}
		}

		return {
			reply: core.Utils.tag.trim `
				${prefix}${command.Name}${aliases}:
				${command.Description ?? "(no description)"}
				${filteredResponse}
				-
				${cooldownString}
				${modifierString}
				${command.getDetailURL()}
			`
		};
	}),
	Dynamic_Description: (prefix) => ([
		"This command helps chatters find specific commands or links a list.",
		"",

		`<code>${prefix}help</code>`,
		`<code>${prefix}commands</code>`,
		"Lists all the commands available in Supibot at the moment, plus the FAQ.",
		`You can see them here: <a href="/bot/command/list">Command list</a> and <a href="/data/faq/list">FAQ</a>.`,
		"",

		`<code>${prefix}help (command name)</code>`,
		`<code>${prefix}help randomline</code>`,
		"Posts the short description of the command in chat, and then also the full article on the website.",
		"",

		`<code>${prefix}helpgrep (name or description)</code>`,
		`<code>${prefix}helpgrep osrs</code>`,
		"Searches for commands that have the keyword(s) in their names or descriptions.",
		"This is useful if you vaguely know what the command does, but aren't sure about its name."
	])
});
