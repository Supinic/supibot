import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";

import { searchYoutube } from "../../utils/command-utils.js";
import { formatWeatherReport } from "../weather/formatting.js";
import { openMeteoWeatherProvider } from "../weather/providers/index.js";
import type { NumericCoordinates } from "../../utils/globals.js";

const url = "https://api.jolpi.ca/ergast/f1/";
const regularSessionTypes = ["FirstPractice", "SecondPractice", "ThirdPractice", "Qualifying"] as const;
const sprintSessionTypes = ["FirstPractice", "SprintQualifying", "Sprint", "Qualifying"] as const;
type SessionType = (typeof regularSessionTypes)[number] | (typeof sprintSessionTypes)[number];

const sessionNames = {
	FirstPractice: "First practice",
	SecondPractice: "Second practice",
	ThirdPractice: "Third practice",
	Qualifying: "Qualifying",
	SprintQualifying: "Sprint qualifying",
	Sprint: "Sprint race"
} as const;

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
const isSprintRace = (input: Race): input is SprintRace => Object.hasOwn(input, "Sprint");

type YearResponse = {
	MRData: {
		RaceTable: {
			season: string;
			Races: Race[];
		};
	};
};

export const getF1Weather = async (sessionStart: number, coordinates: NumericCoordinates, place: string) => {
	const now = SupiDate.now();
	const hourDifference = Math.floor((sessionStart - now) / 36e5);
	if (hourDifference > (14 * 24)) {
		return "Weather forecast is not yet available.";
	}

	let result;
	let prefix: string;
	if (hourDifference <= 1) {
		result = await openMeteoWeatherProvider.getCurrent(coordinates);
		prefix = "Current weather";
	}
	else if (hourDifference < 72) {
		result = await openMeteoWeatherProvider.getHourly(coordinates, hourDifference);
		prefix = "Forecast";
	}
	else {
		const dayDifference = Math.floor(hourDifference / 24);
		result = await openMeteoWeatherProvider.getDaily(coordinates, dayDifference);
		prefix = "Long-term forecast";
	}

	if ("success" in result) {
		return "No weather forecast available at the moment.";
	}

	const { formatted } = formatWeatherReport(result, {
		hiddenLocation: false,
		place,
		customFormat: ["icon", "temperature", "precipitation"]
	});

	return `${prefix}: ${formatted}`;
};

const formulaOneSessionInfoShape = z.object({
	Type: z.string(),
	Path: z.string(),
	StartDate: z.string()
});
const formulaOneStatusShape = z.object({
	Status: z.string()
});

const fetchOfficalRaceStatusFinished = async (race: Race): Promise<boolean | null> => {
	const cacheBust = Math.floor(SupiDate.now() / 15_000);
	const sessionResponse = await core.Got.get("GenericAPI")({
		url: `https://livetiming.formula1.com/static/SessionInfo.json?v=${cacheBust}`,
		responseType: "text"
	});

	// The LiveTiming Formula One API returns JSON with a leading BOM -> `trim()` call gets rid of it
	const cleanedSessionBody = sessionResponse.body.trim();
	const session = formulaOneSessionInfoShape.parse(JSON.parse(cleanedSessionBody));
	if (session.Type !== "Race" || session.StartDate.slice(0, 10) !== race.date) {
		return null;
	}

	const statusResponse = await core.Got.get("GenericAPI")({
		url: `https://livetiming.formula1.com/static/${session.Path}SessionStatus.json?v=${cacheBust}`,
		responseType: "text"
	});

	const cleanedStatusBody = statusResponse.body.trim();
	const data = formulaOneStatusShape.parse(JSON.parse(cleanedStatusBody));
	return (data.Status === "Finished" || data.Status === "Finalised" || data.Status === "Ends");
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
			const raceStart = (race.time)
				? new SupiDate(`${race.date} ${race.time}`)
				: new SupiDate(race.date);

			if (now < raceStart) {
				resultRace = race;
				break;
			}

			// Check whether at least 3 hours passed since the start (the maximum racing window limit)
			const paddedEnd = raceStart.clone().addHours(3);
			if (now >= paddedEnd) {
				// More time passed - skip this race and continue
				continue;
			}

			// Range of <race start, race start + 3 hours> - check whether the race is still officially running
			const raceFinished = await fetchOfficalRaceStatusFinished(race);
			if (raceFinished === true) {
				continue; // Race is labelled as finished in the F1 API - skip and continue
			}

			resultRace = race;
			break;
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
}

type Driver = {
	driverId: string;
	permanentNumber: string;
	code?: string;
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
	Driver: Driver;
	Constructor: Constructor;
	Q1: string;
	Q2?: string;
	Q3?: string;
};
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
	Driver: Driver;
	Constructor: Constructor;
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

export const fetchNextRaceDetail = async () => {
	const { year } = new SupiDate();
	const race = await fetchRace(year, "current");
	if (!race) {
		return {
			success: false,
			reply: `No next F1 race is currently scheduled!`
		};
	}

	const now = new SupiDate();
	const raceStart = new SupiDate(`${race.date} ${race.time}`);
	const raceEnd = raceStart.clone().addHours(2); // Compensate for the race being underway

	let nextSessionString = "";
	let nextSessionStart: SupiDate | number = Infinity;
	let nextSessionEnd: SupiDate | undefined;
	let nextSessionType: SessionType | undefined;

	// Find the first upcoming session that is still scheduled.
	if (isSprintRace(race)) {
		for (const session of sprintSessionTypes) {
			const sessionStart = new SupiDate(`${race[session].date} ${race[session].time}`);
			if (now <= sessionStart && sessionStart.valueOf() < nextSessionStart.valueOf()) {
				nextSessionType = session;
				nextSessionStart = sessionStart;
				nextSessionEnd = nextSessionStart.clone().addHours(2); // Compensate for the session being underway
			}
		}
	}
	else {
		for (const session of regularSessionTypes) {
			const sessionStart = new SupiDate(`${race[session].date} ${race[session].time}`);
			if (now <= sessionStart && sessionStart.valueOf() < nextSessionStart.valueOf()) {
				nextSessionType = session;
				nextSessionStart = sessionStart;
				nextSessionEnd = nextSessionStart.clone().addHours(2); // Compensate for the session being underway
			}
		}
	}

	const coords = {
		lat: Number(race.Circuit.Location.lat),
		lng: Number(race.Circuit.Location.long)
	};

	if (nextSessionEnd && nextSessionType && now < nextSessionEnd) {
		nextSessionString = `Next session: ${sessionNames[nextSessionType]}`;

		if (now < nextSessionStart) {
			nextSessionString += ` is scheduled ${core.Utils.timeDelta(nextSessionStart)}.`;
		}
		else {
			nextSessionString += ` is currently underway.`;
		}

		const weatherResult = await getF1Weather(nextSessionStart.valueOf(), coords, race.Circuit.Location.locality);
		nextSessionString += ` ${weatherResult}`;
	}

	let raceString: string;
	if (now < raceStart) {
		raceString = `Race is scheduled ${core.Utils.timeDelta(raceStart)}.`;
	}
	else if (now < raceEnd) {
		raceString = "Race is currently underway.";
	}
	else {
		throw new SupiError({
			message: "Assert error: Unknown F1 race status",
			args: { raceStart, raceEnd }
		});
	}

	const weatherResult = await getF1Weather(raceStart.valueOf(), coords, race.Circuit.Location.locality);
	raceString += ` ${weatherResult}`;

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

type DriverStandingsResponse = {
	MRData: {
		StandingsTable: {
			season: string;
			round: string;
			StandingsLists: {
				season: string;
				round: string;
				DriverStandings: {
					position: string;
					positionText: string;
					points: string;
					wins: string;
					Driver: Driver;
					constructors: Constructor[];
				}[];
			}[];
		};
	};
};
export const fetchDriverStandings = async (year: number) => {
	const response = await core.Got.get("GenericAPI")<DriverStandingsResponse>({
		url: `${url}${year}/driverStandings.json`
	});

	return response.body.MRData.StandingsTable.StandingsLists[0].DriverStandings;
};

type ConstructorStandingsResponse = {
	MRData: {
		StandingsTable: {
			season: string;
			round: string;
			StandingsLists: {
				season: string;
				round: string;
				ConstructorStandings: {
					position: string;
					positionText: string;
					points: string;
					wins: string;
					Constructor: Constructor;
				}[];
			}[];
		};
	};
};
export const fetchConstructorStandings = async (year: number) => {
	const response = await core.Got.get("GenericAPI")<ConstructorStandingsResponse>({
		url: `${url}${year}/constructorStandings.json`
	});

	return response.body.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
};

export const getHighlights = async (race: Race) => {
	if (!process.env.API_GOOGLE_YOUTUBE) {
		return [];
	}

	return await searchYoutube(`${race.season} ${race.raceName} highlights formula 1`, {
		filterShortsHeuristic: true
	});
};
