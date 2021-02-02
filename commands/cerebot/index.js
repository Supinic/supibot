module.exports = {
	Name: "cerebot",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a command for cerebot to execute.",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: null,
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