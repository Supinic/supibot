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
		switch (target) {
			case "afks": await sb.AwayFromKeyboard.reloadData(); break;
	
			case "bans":
			case "filters": await sb.Filter.reloadData(); break;
	
			case "banphrases": await sb.Banphrase.reloadData(); break;
	
			case "channels": await sb.Channel.reloadData(); break;
	
			case "commands": await sb.Command.reloadData(); break;
			case "command": {
				try {
					await sb.Command.reloadSpecific(target, ...rest);
				}
				catch {
					return {
						success: false,
						reply: "No valid commands provided!"
					};
				}
	
				break;
			}
	
			case "config": await sb.Config.reloadData(); break;
	
			case "cron": await sb.Cron.reloadData(); break;
	
			case "extranews": await sb.ExtraNews.reloadData(); break;
	
			case "got": await sb.Got.reloadData(); break;
	
			case "reminders": await sb.Reminder.reloadData(); break;
	
			case "users": await sb.User.reloadData(); break;
	
			default: return { reply: "Unrecognized module!" };
		}
	
		sb.Master.reloaded = new sb.Date();
	
		return {
			reply: "Reloaded successfully."
		};
	}),
	Dynamic_Description: null
};