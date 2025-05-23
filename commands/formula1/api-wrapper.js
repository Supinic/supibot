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

let jolpicaGotInstance;
const jolpicaGot = (...args) => {
	jolpicaGotInstance ??= core.Got.get("GenericAPI").extend({
		https: {
			rejectUnauthorized: false
		}
	});

	return jolpicaGotInstance(...args);
};

export const getWeather = async (context, sessionStart, coordinates) => {
	const weatherCommand = sb.Command.get("weather");
	if (!weatherCommand) {
		return "Weather checking is not available!";
	}

	const fakeWeatherContext = sb.Command.createFakeContext(weatherCommand, {
		user: context.user,
		params: {
			latitude: Number(coordinates.latitude),
			longitude: Number(coordinates.longitude),
			format: "icon,temperature,precipitation"
		},
		invocation: "weather"
	});

	const now = sb.Date.now();
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

export const fetchRace = async (year, searchType, searchValue) => {
	const response = await jolpicaGot(`${url}${year}.json`);
	const races = response.body.MRData?.RaceTable?.Races ?? [];
	if (races.length === 0) {
		return {
			success: false,
			reply: `This season has no races!`
		};
	}

	if (searchType === "current") {
		const now = new sb.Date();
		let resultRace;

		for (const race of races) {
			const raceDate = (race.time)
				? new sb.Date(`${race.date} ${race.time}`)
				: new sb.Date(race.date);

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
		const lower = searchValue.toLowerCase();

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
		throw new sb.Error({
			message: "Invalid search type provided",
			args: { searchType, searchValue }
		});
	}
};

export const fetchQualifyingResults = async (year, round) => {
	const response = await jolpicaGot(`${url}${year}/${round}/qualifying.json`);
	return response.body.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
};

export const fetchRaceResults = async (year, round) => {
	const response = await jolpicaGot(`${url}${year}/${round}/results.json`);
	return response.body.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
};

export const fetchNextRaceDetail = async (context) => {
	const { month, year } = new sb.Date();
	const race = await fetchRace(year, "current");
	if (!race || race.success === false) {
		// Bump season year only if we are in Nov/Dec, keep the same year otherwise
		const nextSeason = (month >= 11) ? (year + 1) : year;
		const backupRace = BACKUP_RACE_DATA[nextSeason];
		if (backupRace) {
			const delta = core.Utils.timeDelta(new sb.Date(backupRace.date));
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

	const coordinates = {
		latitude: race.Circuit.Location.lat,
		longitude: race.Circuit.Location.long
	};

	const now = new sb.Date();
	const raceStart = new sb.Date(`${race.date} ${race.time}`);
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

		const sessionStart = new sb.Date(`${race[session].date} ${race[session].time}`);
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
