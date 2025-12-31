import type { CheckSubcommandDefinition } from "../index.js";
import { postToHastebin } from "../../../utils/command-utils.js";

const createCacheKey = (type: string, id: number) => `error-${type}-stack-link-${id}`;

export default {
	name: "error",
	title: "Inspect a Supibot Error by its ID",
	aliases: [],
	description: ["If you have been granted access, you can check the full text of an error within Supibot, based on its ID."],
	execute: async (context, rawIdentifier) => {
		const inspectErrorStacks = await context.user.getDataProperty("inspectErrorStacks");
		if (!inspectErrorStacks) {
			return {
				success: false,
				reply: "Sorry, you can't inspect error stacks! If you think you should have access, make a suggestion."
			};
		}

		const identifier = Number(rawIdentifier);
		if (!core.Utils.isValidInteger(identifier)) {
			return {
				success: false,
				reply: "Invalid ID provided!"
			};
		}

		const row = await core.Query.getRow<{ ID: number; Stack: string }>("chat_data", "Error");
		await row.load(identifier, true);

		if (!row.loaded) {
			return {
				success: false,
				reply: "No such error exists!"
			};
		}

		const { ID, Stack: stack } = row.values;
		const cacheKey = createCacheKey("error", ID);

		let link = await core.Cache.getByPrefix(cacheKey) as string | undefined;
		if (!link) {
			const paste = await postToHastebin(stack, { title: `Stack of Supibot error ID ${ID}` });

			if (!paste.ok) {
				return {
					success: false,
					reply: paste.reason
				};
			}

			link = paste.link;
			await core.Cache.setByPrefix(cacheKey, link, {
				expiry: 36e5
			});
		}

		const reply = `Detail of Supibot error ID ${ID}: ${link}`;
		if (context.privateMessage) {
			return { reply };
		}

		await context.platform.pm(reply, context.user, context.channel ?? null);
		return {
			reply: "I private messaged you with the link to the error stack Pastebin 💻"
		};
	}
} satisfies CheckSubcommandDefinition;
