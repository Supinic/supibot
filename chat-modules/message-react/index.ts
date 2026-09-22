import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "message-react",
	description: "According to arguments, reacts to a specific message(s) with a determined response.",
	platform: "all",
	scope: "channel",
	config: z.array(z.object({
		ignoreCase: z.boolean().optional(),
		response: z.string(),
		check: z.union([
			z.object({
				type: z.literal("string"),
				string: z.string()
			}),
			z.object({
				type: z.literal("includes"),
				mode: z.enum(["any", "all"]),
				values: z.array(z.string())
			}),
			z.object({
				type: z.literal("regex"),
				source: z.string()
			})
		])
	})),
	handlers: {
		message (context, runtime) {
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
			for (const item of runtime.config) {
				let passed: boolean;
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
				else {
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
