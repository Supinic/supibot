import { SupiDate, SupiError } from "supi-core";
import type formulaOneCommandDefinition from "./index.js";
import { searchYoutube } from "../../utils/command-utils.js";

import { ExtractContext } from "../../classes/command.js";
import { Coordinates } from "../../@types/globals.js";

export const url = "https://api.jolpi.ca/ergast/f1/";
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

export const fetchNextRaceDetail = async (context: CommandContext) => {
	const { year } = new SupiDate();
	const race = await fetchRace(year, "current");
	if (!race) {
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

	if (nextSessionEnd && nextSessionType && now < nextSessionEnd) {
		nextSessionString = `Next session: ${sessionNames[nextSessionType]}`;

		if (now < nextSessionStart) {
			nextSessionString += ` is scheduled ${core.Utils.timeDelta(nextSessionStart)}.`;
		}
		else {
			nextSessionString += ` is currently underway.`;
		}

		if (context.params.weather) {
			const weatherResult = await getWeather(context, nextSessionStart.valueOf(), coordinates);
			nextSessionString += ` ${weatherResult}`;
		}
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

	if (context.params.weather) {
		const weatherResult = await getWeather(context, raceStart.valueOf(), coordinates);
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
