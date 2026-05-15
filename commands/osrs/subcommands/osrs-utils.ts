import * as z from "zod";
import { SupiError } from "supi-core";
import type { Context } from "../../../classes/command.js";
import type { User } from "../../../classes/user.js";
// import type { CheerioNode } from "supi-core";

import GameData from "./game-data.json" with { type: "json" };
import extraItemData from "./extra-item-data.json" with { type: "json" };
export const { aliases /* , priorities */ } = extraItemData;

import { typedEntries } from "../../../utils/ts-helpers.js";

for (const item of GameData.activities) {
	if (item.toLowerCase() !== item) {
		throw new SupiError({
			message: "Assert error: Non-lowercase activity found",
			args: { item }
		});
	}
}
for (const [alias, activity] of typedEntries(GameData.activityAliases)) {
	if (alias.toLowerCase() !== alias || activity.toLowerCase() !== activity) {
		throw new SupiError({
			message: "Assert error: Non-lowercase activity alias found",
			args: { alias, activity }
		});
	}
}

// export type ActivityName = typeof GameData["activities"][number];
// export type SkillName = typeof GameData["skills"][number]["name"];
export type ActivityAlias = keyof typeof GameData["activityAliases"];

export const isValidActivityAlias = (input: string): input is ActivityAlias => (
	Object.keys(GameData.activityAliases).includes(input)
);
export const getActivityFromAlias = (input: ActivityAlias) => GameData.activityAliases[input];

const activitySchema = z.object({
	name: z.string(),
	rank: z.number().nullable(),
	value: z.number().nullable()
});
const skillSchema = z.object({
	name: z.string(),
	rank: z.number().nullable(),
	level: z.number().nullable(),
	experience: z.number().nullable(),
	virtualLevel: z.number().nullable()
});

const fetchDataSchema = z.object({
	skills: z.array(skillSchema),
	activities: z.array(activitySchema),
	combatLevel: z.number().nullable(),
	seasonal: z.boolean(),
	ironman: z.object({
		regular: z.boolean(),
		hardcore: z.boolean(),
		ultimate: z.boolean(),
		deadHardcore: z.boolean(),
		abandoned: z.boolean()
	})
});
const fetchFailureSchema = z.object({
	data: z.null(),
	error: z.object({
		message: z.string()
	})
});
const fetchSuccessSchema = z.object({
	data: fetchDataSchema,
	error: z.null()
});
const fetchResultSchema = z.union([fetchSuccessSchema, fetchFailureSchema]);

type UserData = z.infer<typeof fetchDataSchema>;
type FetchOptions = {
	seasonal?: boolean;
	force?: boolean;
};

type Failure = {
	success: false;
	reply: string;
};
type UsernameSuccess = {
	success: true;
	username: string;
	type: "string" | "username";
};
type FetchUserSuccess = {
	success: true;
	data: UserData;
};

export const flagEmojis = {
	Australia: "🇦🇺",
	Brazil: "🇧🇷",
	Germany: "🇩🇪",
	"United Kingdom": "🇬🇧",
	"United States": "🇺🇸"
};
const hasFlagEmoji = (input: string): input is keyof typeof flagEmojis => Object.keys(flagEmojis).includes(input);
const createFlagEmoji = (name: string) => (hasFlagEmoji(name)) ? flagEmojis[name] : `(${name})`;

type GameWorldResult = { ok: false } | { ok: true; body: string; };
type GameWorld = {
	country: string;
	type: "free" | "members";
	activity: string | null;
	flagEmoji: string;
};
export type GameWorlds = Record<string, GameWorld>;

export const OSRS_GAME_USERNAME_KEY = "osrsGameUsername";

const osrsItemDataCacheKey = "osrs-item-data";
type WikiItemData = {
	id: number;
	name: string;
	value: number;
	highalch?: number;
};

const isAliasName = (input: string): input is keyof typeof aliases => Object.keys(aliases).includes(input);
// const hasPriority = (input: string): input is keyof typeof priorities => Object.keys(priorities).includes(input);

export const fetchItemId = async (query: string) => {
	let data = await core.Cache.getByPrefix(osrsItemDataCacheKey) as WikiItemData[] | null;
	if (!data) {
		const response = await core.Got.get("GenericAPI")<WikiItemData[]>({
			url: "https://prices.runescape.wiki/api/v1/osrs/mapping"
		});

		data = response.body.map(i => ({
			id: i.id,
			name: i.name,
			value: i.value,
			highalch: i.highalch
		}));

		await core.Cache.setByPrefix(osrsItemDataCacheKey, data, {
			expiry: 7 * 864e5 // 7 days
		});
	}

	query = query.toLowerCase();

	let item: WikiItemData;
	if (isAliasName(query)) {
		const itemId = aliases[query];
		const itemMatch = data.find(i => i.id === itemId);
		if (!itemMatch) {
			throw new SupiError({
				message: "Assert error: Alias item ID not found in data set"
			});
		}

		item = itemMatch;
	}
	else {
		const matches = core.Utils.selectClosestString(query, data.map(i => i.name), {
			ignoreCase: true,
			fullResult: true
		});

		if (!matches) {
			return null;
		}

		const normalizedQuery = RegExp.escape(query.replaceAll(/\s+/g, " "));
		const regexLikeQuery = normalizedQuery.replaceAll(String.raw `\x20`, ".*");
		const regex = new RegExp(`^.*${regexLikeQuery}.*$`, "i");

		const likelyMatches = matches
			.filter(i => i.includes || regex.test(i.string))
			.sort((a, b) => {
				if (a.score !== b.score) {
					return (b.score - a.score);
				}

				return b.string.localeCompare(a.string);
			});

		const bestLikelyMatch = likelyMatches.at(0);
		if (!bestLikelyMatch) {
			return null;
		}

		const bestMatch = data.find(i => i.name === bestLikelyMatch.original);
		if (!bestMatch) {
			throw new SupiError({
				message: "Assert error: Item ID not found from the same set",
				args: { match: matches[0] }
			});
		}

		item = bestMatch;
	}

	return item;
};

export const fetchWorldsData = async (): Promise<GameWorlds | null> => {
	const cacheData = await core.Cache.getByPrefix("osrs-worlds-data") as GameWorlds | null;
	if (cacheData) {
		return cacheData;
	}

	const response = await core.Got.get("FakeAgent")({
		url: "https://oldschool.runescape.com/slu",
		responseType: "text"
	}) as GameWorldResult;

	if (!response.ok) {
		return null;
	}

	const $ = core.Utils.cheerio(response.body);
	const rows = $("tr.server-list__row");
	const worlds: GameWorlds = {};

	for (const row of rows) {
		const list = $("td", row);
		const [idEl] = list;

		// [World name, Player count, Location, Type, Activity]
		const [countryEl, typeEl, activityEl] = list.slice(2);

		// Element might not be present -> optional chaining is warranted
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const id = $("a", idEl)[0]?.attribs.id.split("-").at(-1);
		if (!id) {
			continue;
		}

		const country = $(countryEl).text();
		const type = $(typeEl).text().toLowerCase() as "free" | "members";
		const activity = $(activityEl).text();

		worlds[id] = {
			country,
			type,
			activity: (activity !== "-") ? activity : null,
			flagEmoji: createFlagEmoji(country)
		};
	}

	await core.Cache.setByPrefix("osrs-worlds-data", worlds, {
		expiry: 864e5 // 1 day
	});

	return worlds;
};

const playerCountRegex = /([\d,]+)/;
export const fetchPlayerCount = async (): Promise<number | null> => {
	const response = await core.Got.get("FakeAgent")({
		url: "https://oldschool.runescape.com/slu",
		responseType: "text"
	}) as GameWorldResult;

	if (!response.ok) {
		return null;
	}

	const $ = core.Utils.cheerio(response.body);
	const playerCountNode = $(".player-count");
	if (playerCountNode.length === 0) {
		return null;
	}

	const playerCountStr = playerCountNode.text();
	const match = playerCountStr.match(playerCountRegex);
	if (!match) {
		return null;
	}

	const fixedString = match[1].replaceAll(",", "");
	return Number(fixedString);
};

export const fetchUserData = async (user: string, options: FetchOptions = {}): Promise<FetchUserSuccess | Failure> => {
	const key = (options.seasonal)
		? `osrs-user-data-${user}`
		: `osrs-user-data-${user}-seasonal`;

	if (!options.force) {
		const cacheData = await core.Cache.getByPrefix(key) as UserData | null;
		if (cacheData) {
			return {
				success: true,
				data: cacheData
			};
		}
	}

	let response;
	if (!options.seasonal) {
		response = await core.Got.get("Supinic")({
			url: `osrs/lookup/${user}`
		});
	}
	else {
		response = await core.Got.get("Supinic")({
			url: `osrs/lookup/${user}`,
			searchParams: {
				seasonal: "1"
			}
		});
	}

	const { ok, statusCode } = response;
	const { data, error } = fetchResultSchema.parse(response.body);

	if (!ok || error) {
		if (!error) {
			return {
				success: false,
				reply: "Could not fetch data! Try again later."
			};
		}
		else if (statusCode === 404) {
			return {
				success: false,
				reply: `No data found for player name "${user}"!`
			};
		}
		else if (statusCode === 502 || statusCode === 503) {
			const { message } = error;
			return {
				success: false,
				reply: `Could not reach the OSRS API: ${statusCode} ${message}`
			};
		}
		else {
			const { message } = error;
			return {
				success: false,
				reply: `Supinic OSRS API has failed: ${statusCode} ${message}`
			};
		}
	}

	await core.Cache.setByPrefix(key, data, {
		expiry: 600_000
	});

	return {
		success: true,
		data
	};
};

export const getIronman = (data: UserData, rude: boolean) => {
	let ironman = "user";
	if (data.ironman.deadHardcore) {
		ironman = (rude) ? "ex-hardcore ironman" : "ironman";
	}
	else if (data.ironman.regular) {
		ironman = "ironman";
	}
	else if (data.ironman.hardcore) {
		ironman = "hardcore ironman";
	}
	else if (data.ironman.ultimate) {
		ironman = "ultimate ironman";
	}

	if (ironman !== "user" && data.ironman.abandoned) {
		ironman = `de-ironed ${ironman}`;
	}

	return ironman;
};

export const parseUserIdentifier = async (context: Context, identifier: string): Promise<UsernameSuccess | Failure> => {
	if (identifier.length !== 0 && !identifier.startsWith("@")) {
		return {
			success: true,
			username: identifier,
			type: "string"
		};
	}

	let targetUser: User;
	if (identifier.length === 0) {
		targetUser = context.user;
	}
	else {
		const userData = await sb.User.get(identifier);
		if (!userData) {
			return {
				success: false,
				reply: "No such user exists!"
			};
		}

		targetUser = userData;
	}

	const gameUsername = await targetUser.getDataProperty(OSRS_GAME_USERNAME_KEY);
	if (!gameUsername) {
		const verb = (targetUser === context.user) ? "You" : "They";
		return {
			success: false,
			reply: `${verb} don't have an OSRS username set up!`
		};
	}

	return {
		success: true,
		username: gameUsername,
		type: "username"
	};
};
