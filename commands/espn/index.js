const LEAGUES = {
	nfl: "football",
	nba: "basketball",
	mlb: "baseball",
	nhl: "hockey"
	// Possible future expansions, sourced from https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b
	// college-footbal → football
	// wnba → basketball
	// mens-college-basketball → basketball
	// womens-college-basketball → basketball
};
const LEAGUES_LIST = Object.keys(LEAGUES);
const ALLOWED_COMMAND_MODES = ["next", "scores", "today"];
const GAME_RANGE_DAYS = 90;

const makeUrl = (league) => `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[league]}/${league}/scoreboard`;
const createGamecastLink = (league, gameId) => `https://www.espn.com/${league}/game/_/gameId/${gameId}`;

export default {
	Name: "espn",
	Aliases: ["nba", "nfl", "nhl", "mlb"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Shows info related to the matches played in a variety of North American sports leagues.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "date", type: "date" },
		{ name: "mode", type: "string" }
	],
	Whitelist_Response: null,
	Code: async function espn (context) {
		if (context.invocation === this.Name) {
			return {
				success: false,
				reply: `Use one of the specific sports league aliases instead of the full command name! List: ${LEAGUES_LIST.join(", ")}`
			};
		}

		const mode = context.params.mode ?? "next";
		if (!ALLOWED_COMMAND_MODES.includes(mode)) {
			return {
				success: false,
				reply: `Invalid mode provided! Use one of: ${ALLOWED_COMMAND_MODES.join(", ")}`
			};
		}

		const league = context.invocation;
		const targetDate = (context.params.date)
			? new sb.Date(context.params.date)
			: new sb.Date(sb.Date.getTodayUTC());

		if (mode === "scores") {
			// Adjust for games that already took place in NA timezones, the previous day
			targetDate.addDays(-1);
		}

		const startDate = targetDate.format("Ymd");
		const endDate = targetDate.addDays(GAME_RANGE_DAYS).format("Ymd");
		const response = await core.Got.get("GenericAPI")({
			url: makeUrl(league),
			searchParams: {
				dates: `${startDate}-${endDate}`
			}
		});

		const leagueAbbr = league.toUpperCase();
		if (mode === "next") {
			const event = response.body.events
				.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
				.find(i => i.status.type.completed !== true);

			if (!event) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						No upcoming ${leagueAbbr} match is currently scheduled! 
						Check full info here: https://www.espn.com/${league}/scoreboard
					`
				};
			}

			let playedAtString = "";
			if (event.competitions[0]?.venue) {
				const { venue } = event.competitions[0];
				playedAtString = ` at ${venue.fullName} (${venue.address.city}, ${venue.address.state})`;
			}

			let statusString = "";
			if (event.status && event.status.clock !== 0) {
				statusString = ` Period ${event.status.period}, ${event.status.displayClock}`;
			}

			const link = createGamecastLink(league, event.id);
			const delta = core.Utils.timeDelta(new sb.Date(event.date));
			return {
				reply: `Next ${leagueAbbr} match: ${event.name} ${delta}${playedAtString}.${statusString} ${link}`
			};
		}
		else if (mode === "today") {
			const events = response.body.events
				.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
				.filter(i => i.status.type.completed !== true);

			if (events.length === 0) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						There are no upcoming ${leagueAbbr} matches for today!
						Check full info here: https://www.espn.com/${league}/scoreboard
					`
				};
			}

			const list = events.map(i => `${i.shortName} ${core.Utils.timeDelta(new sb.Date(i.date))}`);
			return {
				reply: `Upcoming ${leagueAbbr} matches: ${list.join("; ")}`
			};
		}
		else if (mode === "scores") {
			const events = response.body.events
				.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
				.filter(i => i.status.type.completed === true);

			if (events.length === 0) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						There are no finished ${leagueAbbr} matches for today!
						Check full info here: https://www.espn.com/${league}/scoreboard
					`
				};
			}

			const list = events.map(event => {
				const teams = event.competitions[0].competitors;
				const [[homeTeam], [awayTeam]] = core.Utils.splitByCondition(teams, (i => i.homeAway === "home"));

				return `${event.shortName} ${awayTeam.score}:${homeTeam.score}`;
			});

			return {
				reply: `Latest ${leagueAbbr} match results: ${list.join("; ")}`
			};
		}
	},
	Dynamic_Description: () => ([
		"Collection of commands related to North American leagues, as covered by the ESPN.",

		`<code>$nba</code>`,
		`<code>$nfl</code>`,
		`<code>$nhl</code>`,
		`<code>$mlb</code>`,
		`<code>$nba mode:next</code>`,
		"Shows the next upcoming match, depending on the league you selected.",
		"",

		`<code>$nba mode:today</code>`,
		`<code>$nfl mode:today</code>`,
		`<code>$nhl mode:today</code>`,
		`<code>$mlb mode:today</code>`,
		"Shows a summary of all upcoming matches for today.",
		"",

		`<code>$nba mode:scores</code>`,
		`<code>$nfl mode:scores</code>`,
		`<code>$nhl mode:scores</code>`,
		`<code>$mlb mode:scores</code>`,
		"Shows a summary of all today's finished matches along with their scores."
	])
};
