import type { Context } from "../../../classes/command.js";
import type { User } from "../../../classes/user.js";
// import type { CheerioNode } from "supi-core";
import GameData from "../game-data.json" with { type: "json" };

// export type ActivityName = typeof GameData["activities"][number];
// export type SkillName = typeof GameData["skills"][number]["name"];
export type ActivityAlias = keyof typeof GameData["activityAliases"];

export const isValidActivityAlias = (input: string): input is ActivityAlias => (
	Object.keys(GameData.activityAliases).includes(input)
);
export const getActivityFromAlias = (input: ActivityAlias) => GameData.activityAliases[input];

type Activity = {
	name: string;
	rank: number | null;
	value: number | null;
};
type Skill = {
	name: string;
	rank: number | null;
	level: number | null;
	experience: number | null;
	virtualLevel: number | null;
};

type FetchOptions = {
	seasonal?: boolean;
	force?: boolean;
};
type FetchData = {
	skills: Skill[];
	activities: Activity[];
	combatLevel: number;
	seasonal: boolean;
	ironman: {
		regular: boolean;
		hardcore: boolean;
		ultimate: boolean;
		deadHardcore: boolean;
		abandoned: boolean;
	};
};

type FetchSuccess = {
	data: FetchData;
	error: null;
};
type FetchFailure = {
	data: null;
	error: { message: string; };
};
type FetchResult = FetchSuccess | FetchFailure;

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
	data: FetchData;
};

export const flagEmojis = {
	Australia: "🇦🇺",
	Germany: "🇩🇪",
	"United Kingdom": "🇬🇧",
	"United States": "🇺🇸"
};

type GameCountry = keyof typeof flagEmojis;
type GameWorldResult = { ok: false } | { ok: true; body: string; };
type GameWorld = {
	country: GameCountry;
	type: "free" | "members";
	activity: string | null;
	flagEmoji: string;
};
type GameWorlds = Record<string, GameWorld>;

export const OSRS_GAME_USERNAME_KEY = "osrsGameUsername";

export const fetchWorldsData = async (): Promise<GameWorlds | null> => {
	let data = await core.Cache.getByPrefix("osrs-worlds-data") as GameWorlds | null;
	if (!data) {
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

			const country = $(countryEl).text() as GameCountry;
			const type = $(typeEl).text().toLowerCase() as "free" | "members";
			const activity = $(activityEl).text();

			worlds[id] = {
				country,
				type,
				activity: (activity !== "-") ? activity : null,
				flagEmoji: flagEmojis[country]
			};
		}

		data = worlds;
		await core.Cache.setByPrefix("osrs-worlds-data", data, {
			expiry: 864e5 // 1 day
		});
	}

	return data;
};

export const fetchUserData = async (user: string, options: FetchOptions = {}): Promise<FetchUserSuccess | Failure> => {
	const key = (options.seasonal)
		? `osrs-user-data-${user}`
		: `osrs-user-data-${user}-seasonal`;

	if (!options.force) {
		const cacheData = await core.Cache.getByPrefix(key) as FetchData | null;
		if (cacheData) {
			return {
				success: true,
				data: cacheData
			};
		}
	}

	let response;
	if (!options.seasonal) {
		response = await core.Got.get("Supinic")<FetchResult>({
			url: `osrs/lookup/${user}`
		});
	}
	else {
		response = await core.Got.get("Supinic")<FetchResult>({
			url: `osrs/lookup/${user}`,
			searchParams: {
				seasonal: "1"
			}
		});
	}

	const { body, ok, statusCode } = response;
	if (!ok && body.error) {
		if (statusCode === 404) {
			return {
				success: false,
				reply: `No data found for player name "${user}"!`
			};
		}
		else if (statusCode === 502 || statusCode === 503) {
			const { message } = body.error;
			return {
				success: false,
				reply: `Could not reach the OSRS API: ${statusCode} ${message}`
			};
		}
		else {
			const { message } = body.error;
			return {
				success: false,
				reply: `Supinic OSRS API has failed: ${statusCode} ${message}`
			};
		}
	}

	const data = body.data as FetchData;
	await core.Cache.setByPrefix(key, data, {
		expiry: 600_000
	});

	return {
		success: true,
		data
	};
};

export const getIronman = (data: FetchData, rude: boolean) => {
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
