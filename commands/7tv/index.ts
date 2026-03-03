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
			emotes: z.object({
				addEmote: z.object({ id: z.string() })
			})
		})
	})
});
const sevenTvRemoveEmoteSchema = z.object({
	data: z.object({
		emoteSets: z.object({
			emotes: z.object({
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

const fetchEmoteSet = async (token: string, channelData: Channel) => {
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
		  emotes(page: 1, perPage: 100) {
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

const addEmote = async (token: string, emoteId: string, setId: string, channelData: Channel) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation AddEmoteToSet($setId: Id!, $emoteId: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				addEmote(id: $emoteId) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables });
	sevenTvAddEmoteSchema.parse(response.body);

	const existingSet = await channelData.getDataProperty("sevenTvRotatingEmotes");
	if (!existingSet) {
		throw new SupiError({
			message: "Assert error: Guaranteed emote set data does not exist",
			args: { channel: channelData.ID }
		});
	}

	existingSet.emotes.push({ id: emoteId, added: SupiDate.now() });
	await channelData.setDataProperty("sevenTvRotatingEmotes", existingSet);
};

const removeEmote = async (token: string, emoteId: string, setId: string, channelData: Channel) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation RemoveEmoteFromSet($setId: Id!, $emoteId: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				removeEmote(id: $emoteId) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables });
	sevenTvRemoveEmoteSchema.parse(response.body);

	const existingSet = await channelData.getDataProperty("sevenTvRotatingEmotes");
	if (!existingSet) {
		throw new SupiError({
			message: "Assert error: Guaranteed emote set data does not exist",
			args: { channel: channelData.ID }
		});
	}

	const emoteIndex = existingSet.emotes.findIndex(i => i.id === emoteId);
	if (emoteIndex === -1) {
		return;
	}

	existingSet.emotes.splice(emoteIndex, 1);
	await channelData.setDataProperty("sevenTvRotatingEmotes", existingSet);
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
		const localData = await fetchEmoteSet(token, context.channel);
		const apiEmotes = await getEmotesInSet(localData.emoteSetId);

		const existing = apiEmotes.some(i => i.id === emoteId);
		if (existing) {
			return {
				success: false,
				reply: "Emote is already in set lul"
			};
		}

		const combinedEmoteData = [];
		for (const emote of apiEmotes) {
			const local = localData.emotes.find(i => i.id === emote.id);
			combinedEmoteData.push({
				id: emote.id,
				added: local?.added ?? 0
			});
		}

		if (combinedEmoteData.length >= EMOTE_LIMIT) {
			const sorted = combinedEmoteData.toSorted((a, b) => a.added - b.added);
			const candidate = sorted[0];

			await removeEmote(token, candidate.id, localData.emoteSetId, context.channel);
		}

		await addEmote(token, emoteId, localData.emoteSetId, context.channel);

		return {
			success: true,
			reply: "Works pog"
		};
	},
	Dynamic_Description: (prefix) => []
});
