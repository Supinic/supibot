import { SupiDate } from "supi-core";
import {
	addEmote,
	fetchSevenTvChannelData,
	fetchSevenTvToken, getEmoteData,
	getEmotesInSet,
	removeEmote,
	SEVEN_TV_DEFAULT_LIMIT,
	sevenTvEmoteIdRegex
} from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";
import { getEmote } from "../../fish/subcommands/fishing-utils.js";

export default {
	name: "add",
	title: "Add emote",
	aliases: [],
	description: [],
	default: true,
	getDescription: () => [
		"Adds an emote to the current channel's rotating list.",
		"If the emote would exceed the current limit, then the oldest one will be removed."
	],
	execute: async (context, ...args) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const match = args.join(" ").match(sevenTvEmoteIdRegex);
		if (!match) {
			return {
				success: false,
				reply: "Could not extract the emote ID from your message! Try posting a 7TV website emote link."
			};
		}

		const emoteId = match[1];
		const localData = await fetchSevenTvChannelData(context.channel);
		const apiEmotes = await getEmotesInSet(localData.emoteSetId);

		const existing = apiEmotes.some(i => i.id === emoteId);
		if (existing) {
			return {
				success: false,
				reply: "This emote is already present in the list of emotes!"
			};
		}

		const emoteData = await getEmoteData(emoteId);
		if (!emoteData || emoteData.deleted) {
			return {
				success: false,
				reply: "That emote either doesn't exist or was deleted!"
			};
		}

		const apiEmoteIds = new Set(apiEmotes.map(i => i.id));
		const combinedEmoteData = localData.emotes.filter(i => apiEmoteIds.has(i.id));
		const limit = localData.limit ?? SEVEN_TV_DEFAULT_LIMIT;
		const token = fetchSevenTvToken();

		let removedEmoteString = "";
		if (combinedEmoteData.length >= limit) {
			let index = 0;
			let added = Infinity;
			for (let i = 0; i < combinedEmoteData.length; i++) {
				const emote = combinedEmoteData[i];
				if (emote.added < added) {
					index = i;
					added = emote.added;
				}
			}

			const candidate = combinedEmoteData[index];
			await removeEmote(token, candidate.id, localData.emoteSetId);

			const [removedEmote] = combinedEmoteData.splice(index, 1);
			removedEmoteString = ` Removed ${removedEmote.name} to make space.`;
		}

		await addEmote(token, emoteId, localData.emoteSetId);

		combinedEmoteData.push({
			id: emoteId,
			added: SupiDate.now(),
			name: emoteData.defaultName
		});

		await context.channel.setDataProperty("sevenTvRotatingEmotes", {
			...localData,
			emotes: combinedEmoteData
		});

		return {
			success: true,
			reply: `Emote ${emoteData.defaultName} successfully added.${removedEmoteString}`
		};
	}
} satisfies SevenTvSubcommandDefinition;
