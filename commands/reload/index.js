module.exports = {
	Name: "reload",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Reloads a database definition or hotloads an updated script",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function reload (context, target, ...rest) {
		let result = null;

		switch (target) {
			case "afks": await sb.AwayFromKeyboard.reloadData(); break;
			case "afk": result  = await sb.AwayFromKeyboard.reloadData(); break;

			case "filters": await sb.Filter.reloadData(); break;
			case "filter": result = await sb.Filter.reloadSpecific(...rest); break;

			case "banphrases": await sb.Banphrase.reloadData(); break;
			case "banphrase": result = await sb.Banphrase.reloadSpecific(...rest); break;

			case "channels": await sb.Channel.reloadData(); break;
			case "channel": result = await sb.Channel.reloadSpecific(...rest); break;

			case "chat-modules":
			case "chatmodules": await sb.ChatModule.reloadData(); break;
			case "chat-module":
			case "chatmodule": result = await sb.ChatModule.reloadSpecific(...rest); break;

			case "commands": await sb.Command.reloadData(); break;
			case "command": result = await sb.Command.reloadSpecific(...rest); break;

			case "config": await sb.Config.reloadData(); break;
	
			case "crons": await sb.Cron.reloadData(); break;
			case "cron": result = await sb.Cron.reloadSpecific(...rest); break;
	
			case "got": await sb.Got.reloadData(); break;
	
			case "reminders": await sb.Reminder.reloadData(); break;
			case "reminder": result = await sb.Reminder.reloadSpecific(...rest); break;
	
			case "users": await sb.User.reloadData(); break;
	
			default: return {
				success: false,
				reply: "Unrecognized module!"
			};
		}

		if (result === false) {
			return {
				success: false,
				reply: `No ${target}s reloaded!`
			};
		}

		return {
			reply: `Successfully reloaded ${target}.`
		};
	}),
	Dynamic_Description: null
};