import * as z from "zod";
import { SupiError } from "supi-core";
import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";
import type { Channel } from "../../../classes/channel.js";
import type { SevenTvRotatingEmotesData } from "../../../classes/custom-data-properties.js";

import AddSubcommand from "./add.js";
import CheckSubcommand from "./check.js";
import LimitSubcommand from "./limit.js";
import RewardSubcommand from "./reward.js";

const subcommands: SubcommandDefinition[] = [
	AddSubcommand,
	CheckSubcommand,
	LimitSubcommand,
	RewardSubcommand
];

export const SevenTvSubcommands = new SubcommandCollection("7tv", subcommands);

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
const sevenTvGetEmoteSchema = z.object({
	data: z.object({
		emotes: z.object({
			emote: z.object({
				defaultName: z.string(),
				deleted: z.boolean()
			}).nullable()
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
export const sevenTvEmoteIdRegex = /([A-Z0-9]{26})/;
export const SEVEN_TV_DEFAULT_LIMIT = 5;

const getSevenTvUserData = async (twitchUserId: string) => {
	const response = await core.Got.get("GenericAPI")({
		url: `https://7tv.io/v3/users/twitch/${twitchUserId}`
	});

	return sevenTvUserIdSchema.parse(response.body).user;
};

export const fetchSevenTvChannelData = async (channelData: Channel) => {
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
	const newSetData: SevenTvRotatingEmotesData = {
		emoteSetId: ownerId,
		emotes: []
	};

	await channelData.setDataProperty("sevenTvRotatingEmotes", newSetData);
	return newSetData;
};

export const getEmotesInSet = async (setId: string) => {
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

export const getEmoteData = async (emoteId: string) => {
	const variables = { emoteId };
	const query = `query OneEmote($emoteId: Id!) {
		emotes {
			emote(id: $emoteId) { 
				defaultName
				deleted
			}
  		}
	}`;

	const response = await core.Got.gql({ url, query, variables });
	const { data } = sevenTvGetEmoteSchema.parse(response.body);
	const { emote } = data.emotes;

	return emote;
};

export const getGlobalEmotes = async () => {
	const twitch = sb.Platform.getAsserted("twitch");
	const emotes = await twitch.fetchGlobalEmotes();
	return emotes.filter(i => i.type === "7tv");
};

export const addEmote = async (token: string, emoteId: string, setId: string) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation AddEmoteToSet($setId: Id!, $emote: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				addEmote(id: $emote) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables, throwHttpErrors: false });
	if (!response.ok) {
		return {
			success: false,
			statusCode: response.statusCode
		};
	}

	sevenTvAddEmoteSchema.parse(response.body);
	return {
		success: true
	};
};

export const removeEmote = async (token: string, emoteId: string, setId: string) => {
	const variables = { emote: { emoteId }, setId };
	const headers = { Authorization: `Bearer ${token}` };
	const query = `mutation RemoveEmoteFromSet($setId: Id!, $emote: EmoteSetEmoteId!) {
		emoteSets {
			emoteSet(id: $setId) {
				removeEmote(id: $emote) { id }
			}
		}
	}`;

	const response = await core.Got.gql({ url, query, headers, variables, throwHttpErrors: false });
	if (!response.ok) {
		return {
			success: false,
			statusCode: response.statusCode
		};
	}

	sevenTvRemoveEmoteSchema.parse(response.body);
	return {
		success: true
	};
};

export const fetchSevenTvToken = (): string => {
	const token = process.env.API_7TV_TOKEN;
	if (!token) {
		throw new SupiError({
			message: "No 7TV token configured (API_7TV_TOKEN)"
		});
	}

	return token;
};
