import * as z from "zod";
import { SupiError } from "supi-core";
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
const sevenTvCreateEmoteSetSchema = z.object({
	data: z.object({
		emoteSets: z.object({
			create: z.object({
				id: z.string()
			})
		})
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

	const { id: ownerId, emote_sets: sets } = await getSevenTvUserData(channelTwitchId);
	const setIds = sets.map(i => i.id);

	const existingSet = await channelData.getDataProperty("sevenTvRotatingEmotes");
	if (existingSet) {
		const hasSet = setIds.includes(existingSet.emoteSetId);
		if (hasSet) {
			return existingSet;
		}
	}

	const name = "Rotating emotes handled by Supibot";
	const variables = { name, ownerId, tags: [] };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation CreateEmoteSet($name: String!, $tags: [String!]!, $ownerId: Id!) {
		emoteSets {
			create(name: $name, tags: $tags, ownerId: $ownerId) {
				id
			}
		}
	}`;

	const response = await core.Got.gql({ url, headers, query, variables });
	const newEmoteSetId = sevenTvCreateEmoteSetSchema.parse(response.body).data.emoteSets.create.id;
	const newSetData = {
		emoteSetId: newEmoteSetId,
		emotes: []
	};

	await channelData.setDataProperty("sevenTvRotatingEmotes", newSetData);
	return newSetData;
};

const getEmotesInSet = async (setId: string) => {
	const variables = { setId };
	const query = `query EmotesInSet(setId: Id!) {
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

const modifyEmoteSet = async (operation: "ADD" | "REMOVE", token: string, emoteId: string, emoteSet: string) => {
	const variables = { emoteId, emoteSet };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation addEmote($emoteSet: ObjectID!, $emoteId: ObjectID!) {
		emoteSet(id: $emoteSet) {
			emotes(id: $emoteId, action: ${operation}) {
				id
				name
			}
		}
	}`;

	const response = await core.Got.gql({ url, variables, headers, query });
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

			await modifyEmoteSet("REMOVE", token, candidate.id, localData.emoteSetId);
		}

		await modifyEmoteSet("ADD", token, emoteId, localData.emoteSetId);

		return {
			success: true,
			reply: "Works pog"
		};
	},
	Dynamic_Description: (prefix) => []
});
