export default {
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
	}),
	Global: false,
	Platform: null
};
