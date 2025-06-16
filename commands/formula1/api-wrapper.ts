import { SupiDate, SupiError } from "supi-core";
import type formulaOneCommandDefinition from "./index.js";
import { ExtractContext } from "../../classes/command.js";
import { Coordinates } from "../../@types/globals.js";

export const url = "https://api.jolpi.ca/ergast/f1/";
const sessionTypes = ["FirstPractice", "SecondPractice", "ThirdPractice", "Qualifying", "Sprint"];
const sessionNames = {
	FirstPractice: "First practice",
	SecondPractice: "Second practice",
	ThirdPractice: "Third practice",
	Qualifying: "Qualifying",
	SprintQualifying: "Sprint qualifying",
	Sprint: "Sprint race"
};

const BACKUP_RACE_DATA = {
	2025: {
		name: "Australian Grand Prix",
		date: "2025-03-16"
	}
};

type GotInstance = NonNullable<ReturnType<typeof core.Got.get>>;
type ExtendedGot = NonNullable<ReturnType<GotInstance["extend"]>>;

let jolpicaGotInstance: ExtendedGot | undefined;
const jolpicaGot = <T> (url: string) => {
	jolpicaGotInstance ??= core.Got.get("GenericAPI").extend({
		https: {
			rejectUnauthorized: false
		}
	});

	return jolpicaGotInstance<T>(url);
};

type Session = { date: string; time: string; };
type BaseRace = {
	season: string;
	round: string;
	url: string;
	raceName: string;
	Circuit: {
		circuitId: string;
		circuitName: string;
		url: string;
		Location: {
			lat: string;
			long: string;
			locality: string;
			country: string;
		};
	}
	date: string;
	time: string;
	Qualifying: Session;
};
type RegularRace = BaseRace & {
	FirstPractice: Session;
	SecondPractice: Session;
	ThirdPractice: Session;
};
type SprintRace = BaseRace & {
	FirstPractice: Session;
	Sprint: Session;
	SprintQualifying: Session;
};
type Race = RegularRace | SprintRace;

type YearResponse = {
	MRData: {
		RaceTable: {
			season: string;
			Races: Race[];
		};
	};
};

type CommandContext = ExtractContext<typeof formulaOneCommandDefinition>;
export const getWeather = async (context: CommandContext, sessionStart: number, coordinates: Coordinates) => {
	const weatherCommand = sb.Command.get("weather");
	if (!weatherCommand) {
		return "Weather checking is not available!";
	}

	const fakeWeatherContext = sb.Command.createFakeContext(weatherCommand, {
		user: context.user,
		platform: context.platform,
		platformSpecificData: context.platformSpecificData,
		params: {
			latitude: Number(coordinates.lat),
			longitude: Number(coordinates.lng),
			format: "icon,temperature,precipitation"
		},
		invocation: "weather"
	});

	const now = SupiDate.now();
	const hourDifference = Math.floor((sessionStart - now) / 36e5);
	if (hourDifference <= 1) {
		const result = await weatherCommand.execute(fakeWeatherContext);
		return `Current weather: ${result.reply ?? "N/A"}`;
	}
	else if (hourDifference < 48) {
		const result = await weatherCommand.execute(fakeWeatherContext, `hour+${hourDifference}`);
		return `Weather forecast: ${result.reply ?? "N/A"}`;
	}
	else if (hourDifference < (7 * 24)) {
		const dayDifference = Math.floor(hourDifference / 24);
		const result = await weatherCommand.execute(fakeWeatherContext, `day+${dayDifference}`);
		return `Weather forecast: ${result.reply ?? "N/A"}`;
	}
	else {
		return "Weather forecast is not yet available.";
	}
};

export async function fetchRace (year: number, searchType: "current"): Promise<Race | null>;
export async function fetchRace (year: number, searchType: "index", searchValue: number): Promise<Race | null>;
export async function fetchRace (year: number, searchType: "name", searchValue: string): Promise<Race | null>;
export async function fetchRace (year: number, searchType: string, searchValue?: string | number) {
	const response = await core.Got.get("GenericAPI")<YearResponse>({
		url: `${url}${year}.json`
	});

	const races = response.body.MRData.RaceTable.Races;
	if (races.length === 0) {
		throw new SupiError({
		    message: "Assert error: Formula 1 season has no races!"
		});
	}

	if (searchType === "current") {
		const now = new SupiDate();
		let resultRace;

		for (const race of races) {
			const raceDate = (race.time)
				? new SupiDate(`${race.date} ${race.time}`)
				: new SupiDate(race.date);

			// Add 2 hours to compensate for the race being underway
			raceDate.addHours(2);

			if (now < raceDate) {
				resultRace = race;
				break;
			}
		}

		return resultRace ?? null;
	}
	else if (searchType === "index") {
		const race = races.find(i => Number(i.round) === searchValue);
		return race ?? null;
	}
	else if (searchType === "name") {
		let resultRace;
		const lower = String(searchValue).toLowerCase();

		for (const race of races) {
			const raceName = race.raceName.toLowerCase();
			const circuitName = race.Circuit.circuitName.toLowerCase();
			const location = race.Circuit.Location.locality.toLowerCase();
			const country = race.Circuit.Location.country.toLowerCase();

			if (raceName.includes(lower) || circuitName.includes(lower) || location.includes(lower) || country.includes(lower)) {
				resultRace = race;
				break;
			}
		}

		return resultRace ?? null;
	}
	else {
		throw new SupiError({
			message: "Invalid search type provided",
			args: { searchType, searchValue }
		});
	}
};

type Driver = {
	driverId: string;
	permanentNumber: string;
	code: string;
	url: string;
	givenName: string;
	familyName: string;
	dateOfBirth: string;
	nationality: string;
};
type Constructor = {
	constructorId: string;
	url: string;
	name: string;
	nationality: string;
};

type QualifyingResult = {
	number: string;
	position: string;
	driver: Driver;
	constructor: Constructor;
	Q1: string;
	Q2?: string;
	Q3?: string;
}
type QualifyingResponse = YearResponse & {
	MRData: {
		RaceTable: {
			Races: (Race & {
				QualifyingResults: QualifyingResult[];
			})[];
		}
	}
};
export const fetchQualifyingResults = async (year: number, round: number) => {
	const response = await core.Got.get("GenericAPI")<QualifyingResponse>({
		url: `${url}${year}/${round}/qualifying.json`
	});

	return response.body.MRData.RaceTable.Races[0].QualifyingResults;
};

type RaceResult = {
	number: string;
	position: string;
	positionText: string;
	points: string;
	driver: Driver;
	constructor: Constructor;
	grid: string;
	laps: string;
	status: string;
	Time: {
		millis: string;
		time: string;
	};
	FastestLap: {
		rank: string;
		lap: string;
		Time: { time: string; };
	};
};
type RaceDetailResponse = YearResponse & {
	MRData: {
		RaceTable: {
			Races: (Race & {
				Results: RaceResult[];
			})[];
		};
	};
};
export const fetchRaceResults = async (year: number, round: number) => {
	const response = await core.Got.get("GenericAPI")<RaceDetailResponse>({
		url: `${url}${year}/${round}/results.json`
	});

	return response.body.MRData.RaceTable.Races[0].Results;
};

export const fetchNextRaceDetail = async (context: CommandContext) => {
	const { month, year } = new SupiDate();
	const race = await fetchRace(year, "current");
	if (!race) {
		// Bump season year only if we are in Nov/Dec, keep the same year otherwise
		const nextSeason = (month >= 11) ? (year + 1) : year;
		const backupRace = BACKUP_RACE_DATA[nextSeason];
		if (backupRace) {
			const delta = core.Utils.timeDelta(new SupiDate(backupRace.date));
			return {
				success: true,
				reply: core.Utils.tag.trim `
					The ${year - 1} season is finished.
					The first race of the ${year} season is ${backupRace.name},
					taking place ${delta}.
				 `
			};
		}

		return {
			success: false,
			reply: `No next F1 race is currently scheduled!`
		};
	}

	const coordinates: Coordinates = {
		lat: race.Circuit.Location.lat,
		lng: race.Circuit.Location.long
	};

	const now = new SupiDate();
	const raceStart = new SupiDate(`${race.date} ${race.time}`);
	const raceEnd = raceStart.clone().addHours(2); // Compensate for the race being underway

	let nextSessionString = "";
	let nextSessionStart = Infinity;
	let nextSessionEnd;
	let nextSessionType;

	// Find the first upcoming session that is still scheduled.
	for (const session of sessionTypes) {
		if (!race[session]) {
			continue;
		}

		const sessionStart = new SupiDate(`${race[session].date} ${race[session].time}`);
		if (now <= sessionStart && sessionStart < nextSessionStart) {
			nextSessionType = session;
			nextSessionStart = sessionStart;
			nextSessionEnd = nextSessionStart.clone().addHours(2); // Compensate for the session being underway
		}
	}

	if (nextSessionStart && now < nextSessionEnd) {
		nextSessionString = `Next session: ${sessionNames[nextSessionType]}`;

		if (now < nextSessionStart) {
			nextSessionString += ` is scheduled ${core.Utils.timeDelta(nextSessionStart)}.`;
		}
		else {
			nextSessionString += ` is currently underway.`;
		}

		if (context.params.weather) {
			const weatherResult = await getWeather(context, nextSessionStart, coordinates);
			nextSessionString += ` ${weatherResult}`;
		}
	}

	let raceString;
	if (now < raceStart) {
		raceString = `Race is scheduled ${core.Utils.timeDelta(raceStart)}.`;
	}
	else if (now < raceEnd) {
		raceString = "Race is currently underway.";
	}

	if (context.params.weather) {
		const weatherResult = await getWeather(context, raceStart, coordinates);
		raceString += ` ${weatherResult}`;
	}

	return {
		reply: core.Utils.tag.trim `
			Next F1 race:
			Round ${race.round} - ${race.raceName}.
			${nextSessionString}
			${raceString}					
			Check more session times here: https://f1calendar.com/			
		`
	};
};

export const fetchDriverStandings = async (year) => {
	const response = await jolpicaGot(`${url}${year}/driverStandings.json`);
	return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
};

export const fetchConstructorStandings = async (year) => {
	const response = await jolpicaGot(`${url}${year}/constructorStandings.json`);
	return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
};

export default {
	url,
	fetchDriverStandings,
	fetchConstructorStandings,
	fetchRace,
	fetchQualifyingResults,
	fetchRaceResults,
	fetchNextRaceDetail
};
