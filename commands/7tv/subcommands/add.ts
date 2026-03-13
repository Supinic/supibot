import { SupiDate } from "supi-core";
import {
	addEmote,
	fetchSevenTvChannelData,
	fetchSevenTvToken,
	getEmoteData,
	getEmotesInSet,
	getGlobalEmotes,
	removeEmote,
	SEVEN_TV_DEFAULT_LIMIT,
	sevenTvEmoteIdRegex
} from "./index.js";
import type { SevenTvSubcommandDefinition } from "../index.js";
import { type MessageData as TwitchMessageData } from "../../../platforms/twitch.js";

export default {
	name: "add",
	title: "Add emote",
	aliases: [],
	description: [],
	default: true,
	getDescription: (prefix) => [
		"Adds an emote to the current channel's rotating list.",
		"If the emote would exceed the current limit, then the oldest one will be removed.",
		"",

		`<code>${prefix}7tv (emote link or ID)</code>`,
		`<code>${prefix}7tv add (emote link or ID)</code>`,
		"Adds the selected emote to the list of rotating emotes.",
		"If the amount of emotes would bypass the limit, the oldest added one will be removed automatically.",
		`You can use this command directly, without using the "add" operation.`
	],
	execute: async (context, ...args) => {
		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const localData = await fetchSevenTvChannelData(context.channel);
		if ("addRedemption" in localData && localData.addRedemption) {
			const { id, active, name } = localData.addRedemption;
			const data = context.platformSpecificData as TwitchMessageData; // @todo fix with proper inferring from TwitchPlatform
			if (active && data.rewardId !== id) {
				return {
					success: false,
					reply: `You can only add emotes when using the "${name}" channel points reward!`
				};
			}
		}

		const match = args.join(" ").match(sevenTvEmoteIdRegex);
		if (!match) {
			return {
				success: false,
				reply: "You didn't provide a proper emote ID! Post a 7TV website emote link."
			};
		}

		const emoteId = match[1];
		const globalEmotes = await getGlobalEmotes();
		const globalCollision = globalEmotes.find(i => i.ID === emoteId);
		if (globalCollision) {
			return {
				success: false,
				reply: `Can't add ${globalCollision.name} because it's a global emote!`
			};
		}

		const apiEmotes = await getEmotesInSet(localData.emoteSetId);
		const existing = apiEmotes.some(i => i.id === emoteId);
		if (existing) {
			return {
				success: false,
				reply: "Emote is already present in the list of emotes!"
			};
		}

		const emoteData = await getEmoteData(emoteId);
		if (!emoteData || emoteData.deleted) {
			return {
				success: false,
				reply: "Emote either doesn't exist or was deleted!"
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
			const result = await removeEmote(token, candidate.id, localData.emoteSetId);
			if (!result.success) {
				return {
					success: false,
					reply: `Could not add emote! Check if I am set up as the 7TV editor for this channel (error code ${result.statusCode})`
				};
			}

			const [removedEmote] = combinedEmoteData.splice(index, 1);
			removedEmoteString = ` Removed ${removedEmote.name} to make space.`;
		}

		const addResult = await addEmote(token, emoteId, localData.emoteSetId);
		if (!addResult.success) {
			return {
				success: false,
				reply: `Could not add emote! Check if I am set up as the 7TV editor for this channel (error code ${addResult.statusCode})`
			};
		}

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
			reply: `Added ${emoteData.defaultName} to the list.${removedEmoteString}`
		};
	}
} satisfies SevenTvSubcommandDefinition;
