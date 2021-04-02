module.exports = {
	Name: "message-react",
	Events: ["message"],
	Description: "According to arguments, reacts to a specific message(s) with a determined response.",
	Code: (async function chatModuleMessageReact (context, ...args) {
		if (args.length === 0) {
			return;
		}

		const { channel, platform, user } = context;
		if (!user) {
			return;
		}
		else if (user.Name === platform.Self_Name) {
			return;
		}

		const { message } = context;
		for (const item of args) {
			let adjustedMessage = message;
			let check = item.check;
			if (item.ignoreCase) {
				check = check.toLowerCase();
				adjustedMessage = adjustedMessage.toLowerCase();
			}

			if (adjustedMessage === check) {
				if (typeof item.response === "string") {
					await channel.send(item.response);
				}
				else if (typeof item.callback === "function") {
					await item.callback(context, item);
				}
			}
		}
	}),
	Author: "supinic"
};