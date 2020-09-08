module.exports = {
	Name: "cerebot",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Posts a command for cerebot to execute.",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cerebot (context, ...args) {
		let message = args.join(" ").trim();
		if (!message.startsWith("!")) {
			message = "!" + message;
		}
	
		await sb.Channel.get(7).send(message);
		return null;
	}),
	Dynamic_Description: null
};