import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "message-react",
	description: "According to arguments, reacts to a specific message(s) with a determined response.",
	platform: "all",
	scope: "channel",
	handlers: {
		message (context, ...args: any[]) {
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
			else if (channel.Mode === "Read") {
				return;
			}

			const { message } = context;
			for (const item of args) {
				let passed = false;
				const { ignoreCase = false, check, response } = item;
				const checkMessage = (ignoreCase) ? message.toLowerCase() : message;

				if (check.type === "string") {
					const { string } = check;
					passed = (ignoreCase)
						? (checkMessage === string.toLowerCase())
						: (checkMessage === string);
				}
				else if (check.type === "includes") {
					const { mode, values } = check;
					if (mode === "any") {
						passed = values.some(i => (ignoreCase)
							? (checkMessage.includes(i.toLowerCase()))
							: (checkMessage.includes(i))
						);
					}
					else {
						passed = values.every(i => (ignoreCase)
							? (checkMessage.includes(i.toLowerCase()))
							: (checkMessage.includes(i))
						);
					}
				}
				else if (check.type === "regex") {
					const { source } = check;
					const regex = core.Utils.parseRegExp(source);
					if (!regex) {
						continue;
					}

					passed = regex.test(checkMessage);
				}

				if (passed) {
					void channel.send(response);
				}
			}
		}
	}
});
