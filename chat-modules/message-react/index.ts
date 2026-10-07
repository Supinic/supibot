import * as z from "zod";
import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.ts";

const DEFAULT_TIMEOUT = 2500;

export default defineChatModule({
	name: "message-react",
	description: "According to arguments, reacts to a specific message(s) with a determined response.",
	platform: "all",
	scope: "channel",
	config: z.array(z.object({
		timeout: z.int().min(500).optional(),
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
	state: () => ({ timeout: [] as number[] }),
	handlers: {
		message (context, { config, state }) {
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

			const now = SupiDate.now();
			const { message } = context;

			for (let i = 0; i < config.length; i++) {
				let passed: boolean;
				const item = config[i];
				const { ignoreCase = false, check, response, timeout = DEFAULT_TIMEOUT } = item;
				const checkMessage = (ignoreCase) ? message.toLowerCase() : message;

				const itemTimeout = state.timeout[i] ?? 0;
				if (now < itemTimeout) {
					continue;
				}

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
					state.timeout[i] = now + timeout;
				}
			}
		}
	}
});
