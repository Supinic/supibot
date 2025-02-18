import type User from "../../../classes/user.js";

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

// @todo Import from Command when done in Typescript
interface Context {
	user: User;
}

const DB_GAME_USERNAME = "osrsGameUsername";

export default {
	fetch: async (user: string, options: FetchOptions = {}): Promise<FetchData | Failure> => {
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
	},

	getIronman: (data: FetchData, rude: boolean) => {
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
	},

	parseUserIdentifier: async (context: Context, identifier: string): Promise<UsernameSuccess | Failure> => {
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
	}
};
