import type User from "../../../classes/user.js";
// import type { CheerioNode } from "supi-core";

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
	ok: true;
	statusCode: 200;
	body: {
		data: FetchData;
		error: null;
	};
};
type FetchFailure = {
	ok: false;
	statusCode: 404 | 502 | 503;
	body: {
		data: null;
		error: { message: string; };
	};
};
type FetchResult = FetchSuccess | FetchFailure;

type Failure = {
	success: false;
	reply: string;
};
type UsernameSuccess = {
	success: true;
	username: string;
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

// @todo Import from Command when done in Typescript
interface Context {
	user: User;
}

const DB_GAME_USERNAME = "osrsGameUsername";

export const fetchWorldsData = async (): Promise<GameWorlds | null> => {
	let data: GameWorlds | null = await sb.Cache.getByPrefix("osrs-worlds-data");
	if (!data) {
		const response = await sb.Got.get("FakeAgent")({
			url: "https://oldschool.runescape.com/slu",
			responseType: "text"
		}) as GameWorldResult;

		if (!response.ok) {
			return null;
		}

		const $ = sb.Utils.cheerio(response.body);
		const rows = $("tr.server-list__row");
		const worlds: GameWorlds = {};

		for (const row of rows) {
			// @todo check with Cheerio types when supi-core#exports-refactor is merged
			const [idEl, playersEl, countryEl, typeEl, activityEl] = $("td", row);
			const id = $("a", idEl)[0]?.attribs.id.split("-").at(-1)
			if (!id) {
				continue;
			}

			const country = $(countryEl).text() as GameCountry;
			const type = $(typeEl).text().toLowerCase() as "free" | "members";
			const activity = $(activityEl).text() as string;

			worlds[id] = {
				country,
				type,
				activity: (activity !== "-") ? activity : null,
				flagEmoji: flagEmojis[country]
			};
		}

		data = worlds;
		await sb.Cache.setByPrefix("osrs-worlds-data", data, {
			expiry: 864e5 // 1 day
		});
	}

	return data;
};

export const fetchUserData = async (user: string, options: FetchOptions = {}): Promise<FetchData | Failure> => {
	const key = (options.seasonal)
		? `osrs-user-data-${user}`
		: `osrs-user-data-${user}-seasonal`;

	let data: FetchData | null = (options.force)
		? null
		: await sb.Cache.getByPrefix(key);

	if (!data) {
		let response: FetchResult;
		if (!options.seasonal) {
			response = await sb.Got.get("Supinic")({
				url: `osrs/lookup/${user}`
			}) as FetchResult;
		}
		else {
			response = await sb.Got.get("Supinic")({
				url: `osrs/lookup/${user}`,
				searchParams: {
					seasonal: "1"
				}
			});
		}

		if (!response.ok) {
			if (response.statusCode === 404) {
				return {
					success: false,
					reply: `No data found for player name "${user}"!`
				};
			}
			else if (response.statusCode === 502 || response.statusCode === 503) {
				const { message } = response.body.error;
				return {
					success: false,
					reply: `Could not reach the OSRS API: ${response.statusCode} ${message}`
				};
			}
			else {
				const { message } = response.body.error;
				return {
					success: false,
					reply: `Supinic OSRS API has failed: ${response.statusCode} ${message}`
				};
			}
		}

		data = response.body.data;
		await sb.Cache.setByPrefix(key, data, {
			expiry: 600_000
		});
	}

	return data;
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
			username: identifier
		};
	}

	let targetUser: User;
	if (identifier.length === 0) {
		targetUser = context.user;
	}
	else {
		targetUser = await sb.User.get(identifier);
		if (!targetUser) {
			return {
				success: false,
				reply: "No such user exists!"
			};
		}
	}

	const gameUsername = await targetUser.getDataProperty(DB_GAME_USERNAME) as null | string;
	if (!gameUsername) {
		const verb = (targetUser === context.user) ? "You" : "They"
		return {
			success: false,
			reply: `${verb} don't have an OSRS username set up!`
		};
	}

	return {
		success: true,
		username: gameUsername
	};
};
