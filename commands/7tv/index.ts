import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";
import type Channel from "../../classes/channel.js";
import { declare } from "../../classes/command.js";

const EMOTE_LIMIT = 5;

const sevenTvUserIdSchema = z.object({
	user: z.object({
		id: z.string(),
		emote_sets: z.array(z.object({
			id: z.string(),
			name: z.string()
		}))
	})
});
const sevenTvEmoteSetEmotesSchema = z.object({
	data: z.object({
		emoteSets: z.object({
			emoteSet: z.object({
				emotes: z.object({
					items: z.array(z.object({
						id: z.string(),
						alias: z.string()
					}))
				})
			})
		})
	})
});
const sevenTvAddEmoteSchema = z.object({
	data: z.object({
		emoteSets: z.object({
			emoteSet: z.object({
				addEmote: z.object({ id: z.string() })
			})
		})
	})
});
const sevenTvRemoveEmoteSchema = z.object({
	data: z.object({
		emoteSets: z.object({
			emoteSet: z.object({
				removeEmote: z.object({ id: z.string() })
			})
		})
	})
});

const url = "https://7tv.io/v4/gql";
const getSevenTvUserData = async (twitchUserId: string) => {
	const response = await core.Got.get("GenericAPI")({
		url: `https://7tv.io/v3/users/twitch/${twitchUserId}`
	});

	return sevenTvUserIdSchema.parse(response.body).user;
};

const fetchEmoteSet = async (channelData: Channel) => {
	if (channelData.Platform.name !== "twitch") {
		throw new SupiError({
			message: "Channel is not Twitch lol"
		});
	}

	const channelTwitchId = channelData.Specific_ID;
	if (!channelTwitchId) {
		throw new SupiError({
			message: "Assert error: Twitch channel has no user ID"
		});
	}

	const existingSet = await channelData.getDataProperty("sevenTvRotatingEmotes");
	if (existingSet) {
		return existingSet;
	}

	const { id: ownerId } = await getSevenTvUserData(channelTwitchId);
	const newSetData = {
		emoteSetId: ownerId,
		emotes: []
	};

	await channelData.setDataProperty("sevenTvRotatingEmotes", newSetData);
	return newSetData;
};

const getEmotesInSet = async (setId: string) => {
	const variables = { setId };
	const query = `query EmotesInSet($setId: Id!) {
	  emoteSets {
		emoteSet(id: $setId) {
		  emotes(page: 1, perPage: 1000) {
			items { 
				id
				alias
		 	}
		  }
		}
	  }
	}`;

	const response = await core.Got.gql({ url, query, variables });
	return sevenTvEmoteSetEmotesSchema.parse(response.body).data.emoteSets.emoteSet.emotes.items;
};

const addEmote = async (token: string, emoteId: string, setId: string) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation AddEmoteToSet($setId: Id!, $emote: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				addEmote(id: $emote) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables });
	sevenTvAddEmoteSchema.parse(response.body);
};

const removeEmote = async (token: string, emoteId: string, setId: string) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation RemoveEmoteFromSet($setId: Id!, $emote: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				removeEmote(id: $emote) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables });
	sevenTvRemoveEmoteSchema.parse(response.body);
};

const sevenTvIdRegex = /([A-Z0-9]{26})/;

export default declare({
	Name: "7tv",
	Aliases: null,
	Cooldown: 10000,
	Description: "",
	Flags: ["whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: async function sevenTv (context, ...args) {
		const token = process.env.API_7TV_TOKEN;
		if (!token) {
			throw new SupiError({
				message: "No 7TV token configured (API_7TV_TOKEN)"
			});
		}

		if (!context.channel) {
			return {
				success: false,
				reply: "Lol Todo"
			};
		}

		const match = args.join(" ").match(sevenTvIdRegex);
		if (!match) {
			return {
				success: false,
				reply: "No emote found id xd"
			};
		}

		const emoteId = match[1];
		const localData = await fetchEmoteSet(context.channel);
		const apiEmotes = await getEmotesInSet(localData.emoteSetId);

		const existing = apiEmotes.some(i => i.id === emoteId);
		if (existing) {
			return {
				success: false,
				reply: "Emote is already in set lul"
			};
		}

		const apiEmoteIds = new Set(apiEmotes.map(i => i.id));
		const combinedEmoteData = localData.emotes.filter(i => apiEmoteIds.has(i.id));

		if (combinedEmoteData.length >= EMOTE_LIMIT) {
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

			combinedEmoteData.splice(index, 1);
		}

		await addEmote(token, emoteId, localData.emoteSetId);
		combinedEmoteData.push({ id: emoteId, added: SupiDate.now() });

		await context.channel.setDataProperty("sevenTvRotatingEmotes", {
			emoteSetId: localData.emoteSetId,
			emotes: combinedEmoteData
		});

		return {
			success: true,
			reply: "Works pog"
		};
	},
	Dynamic_Description: (prefix) => []
});
