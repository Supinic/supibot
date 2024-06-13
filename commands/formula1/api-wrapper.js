const url = "https://ergast.com/api/f1/";
const sessionTypes = ["FirstPractice", "SecondPractice", "ThirdPractice", "Qualifying", "Sprint"];
const sessionNames = {
	FirstPractice: "First practice",
	SecondPractice: "Second practice",
	ThirdPractice: "Third practice",
	Qualifying: "Qualifying",
	Sprint: "Sprint race"
};

let ergastGotInstance;
const ergastGot = (...args) => {
	ergastGotInstance ??= sb.Got.get("GenericAPI").extend({
		https: {
			rejectUnauthorized: false
		}
	});

	return ergastGotInstance(...args);
};

const getWeather = async (context, sessionStart, coordinates) => {
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

const fetchRace = async (year, searchType, searchValue) => {
	const response = await ergastGot(`${url}${year}.json`);
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

const fetchQualifyingResults = async (year, round) => {
	const response = await ergastGot(`${url}${year}/${round}/qualifying.json`);
	return response.body.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
};

const fetchRaceResults = async (year, round) => {
	const response = await ergastGot(`${url}${year}/${round}/results.json`);
	return response.body.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
};

const fetchNextRaceDetail = async (context) => {
	const year = new sb.Date().year;
	const race = await fetchRace(year, "current");
	if (!race) {
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
			nextSessionString += ` is scheduled ${sb.Utils.timeDelta(nextSessionStart)}.`;
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
		raceString = `Race is scheduled ${sb.Utils.timeDelta(raceStart)}.`;
	}
	else if (now < raceEnd) {
		raceString = "Race is currently underway.";
	}

	if (context.params.weather) {
		const weatherResult = await getWeather(context, raceStart, coordinates);
		raceString += ` ${weatherResult}`;
	}

	return {
		reply: sb.Utils.tag.trim `
			Next F1 race:
			Round ${race.round} - ${race.raceName}.
			${nextSessionString}
			${raceString}					
			Check more session times here: https://f1calendar.com/			
		`
	};
};

const fetchDriverStandings = async (year) => {
	const response = await ergastGot(`${url}${year}/driverStandings.json`);
	return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
};

const fetchConstructorStandings = async (year) => {
	const response = await ergastGot(`${url}${year}/constructorStandings.json`);
	return response.body.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
};

module.exports = {
	url,
	fetchDriverStandings,
	fetchConstructorStandings,
	fetchRace,
	fetchQualifyingResults,
	fetchRaceResults,
	fetchNextRaceDetail
};
