import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";
import { setTimeout as sleep } from "node:timers/promises";

const REASONABLE_PYRAMID_MAXIMUM = 10;
const DEFAULT_DELAY = 250;

export default declare({
	Name: "pyramid",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Creates a pyramid in chat. Only usable in chats where Supibot is a VIP or a Moderator.",
	Flags: ["developer","whitelist"],
	Params: [
		{ name: "delay", type: "number" },
		{ name: "wait", type: "boolean" }
	] as const,
	Whitelist_Response: null,
	Code: (async function pyramid (context, ...args) {
		if (!context.channel) {
			return {
				success: false,
				reply: `Cannot use this command in private messages!`
			};
		}
		else if (context.channel.Mode !== "Moderator" && context.channel.Mode !== "VIP") {
			return {
				success: false,
				reply: "Cannot create pyramids in a non-VIP/Moderator chat!"
			};
		}
		else if (args.length < 2) {
			return {
			    success: false,
			    reply: "You must provide some text to pyramid-ify and the syze of the pyramid!"
			};
		}

		const words = [...args];
		const size = Number(words.pop());
		if (Number.isNaN(size)) {
			return {
			    success: false,
			    reply: "You must provide the size as the last parameter!"
			};
		}
		else if (!core.Utils.isValidInteger(size, 0) || size >= REASONABLE_PYRAMID_MAXIMUM) {
			return {
				success: false,
				reply: `Your provided pyramid height is not a positive integer, or is larger than the maximum of (${REASONABLE_PYRAMID_MAXIMUM})!`
			};
		}

		let delay = DEFAULT_DELAY;
		if (typeof context.params.delay === "number") {
			const permissions = await context.getUserPermissions();
			if (!permissions.is("administrator")) {
				return {
				    success: false,
				    reply: "Only administrators can change the pyramid message delay!"
				};
			}

			delay = context.params.delay;
			if (delay <= 0 || delay >= 10_000) {
				return {
				    success: false,
				    reply: "Provided delay is out of practical bounds!"
				};
			}
		}

		// sanity check
		if (words.length === 0) {
			throw new SupiError({
			    message: "Assert error: words array is empty"
			});
		}

		const text = `${words.join(" ")} `; // add space for easier concatenation and length checking
		const limit = context.channel.Message_Limit ?? context.platform.Message_Limit;
		if ((text.length * size) > limit) {
			return {
				success: false,
				reply: `Your pyramid is too wide! The longest line wouldn't fit into one message (${(text.length * size)}/${limit}})`
			};
		}

		const awaitPromise = context.params.wait ?? true;
		for (let i = 1; i <= size; i++) {
			const promise = context.channel.send(text.repeat(i));
			if (awaitPromise) {
				await promise;
			}

			await sleep(delay);
		}

		for (let i = (size - 1); i > 0; i--) {
			const promise = context.channel.send(text.repeat(i));
			if (awaitPromise) {
				await promise;
			}

			await sleep(delay);
		}

		return {
			success: true,
			reply: null
		};
	}),
	Dynamic_Description: null
});
