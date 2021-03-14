module.exports = {
	Name: "message-react",
	Events: ["message"],
	Description: "According to arguments, reacts to a specific message(s) with a determined response.",
	Code: (async function chatModuleNice (context, options = {}) {
		const { check, ignoreCase, response } = options;
		if (!check || !response) {
			return;
		}

		const { channel, platform, user } = context;
		if (!user) {
			return;
		}
		else if (user.Name === platform.Self_Name) {
			return;
		}

		let { message } = context;
		if (ignoreCase) {
			message = message.toLowerCase();
		}

		if ((typeof check === "string" && message === check ) || (Array.isArray(check) && check.includes(message))) {
			await channel.send(response);
		}
	}),
	Author: "supinic"
};