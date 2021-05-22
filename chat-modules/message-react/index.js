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
		else if (channel.mode === "Read") {
			return;
		}

		const { message } = context;
		for (const item of args) {
			let adjustedMessage = message;
			let check = item.check;
			let passed = false;

			if (typeof check === "string") {
				if (item.ignoreCase) {
					check = check.toLowerCase();
					adjustedMessage = adjustedMessage.toLowerCase();
				}

				passed = (adjustedMessage === check);
			}
			else if (check instanceof RegExp) {
				passed = check.test(message);
			}
			else if (typeof check === "function") {
				passed = await check(context, message);
			}
			else {
				console.warn("Incorrect chat-module check type", {
					chatModule: this.Name,
					channel: channel.ID,
					item
				});
			}

			if (!passed) {
				return;
			}

			if (typeof item.response === "string") {
				await channel.send(item.response);
			}
			else if (typeof item.callback === "function") {
				await item.callback(context, item);
			}
			else {
				console.warn("Incorrect chat-module response type", {
					chatModule: this.Name,
					channel: channel.ID,
					item
				});
			}
		}
	}),
	Author: "supinic"
};
