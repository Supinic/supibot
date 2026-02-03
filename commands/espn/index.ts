import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";

const espnSchema = z.object({
	events: z.array(z.object({
		id: z.string(),
		uid: z.string(),
		name: z.string(),
		date: z.iso.datetime(),
		shortName: z.string(),
		competitions: z.array(z.object({
			competitors: z.array(z.object({
				id: z.string(),
				homeAway: z.enum(["home", "away"]),
				score: z.string()
			})),
			venue: z.object({
				id: z.string(),
				fullName: z.string(),
				address: z.object({
					city: z.string(),
					state: z.string(),
					country: z.string()
				})
			}).optional()
		})),
		season: z.object({
			year: z.int(),
			type: z.int(),
			slug: z.string()
		}),
		status: z.object({
			clock: z.number(),
			displayClock: z.string(),
			period: z.int(),
			type: z.object({
				completed: z.boolean(),
				description: z.string()
			})
		})
	}))
});

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
} as const;
const LEAGUES_LIST = Object.keys(LEAGUES);
const ALLOWED_COMMAND_MODES = ["next", "scores", "today"] as const;
const GAME_RANGE_DAYS = 90;

const isCommand = (input: string): input is typeof ALLOWED_COMMAND_MODES[number] => (
	(ALLOWED_COMMAND_MODES as readonly string[]).includes(input)
);

const makeUrl = (league: keyof typeof LEAGUES) => `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[league]}/${league}/scoreboard`;
const createGamecastLink = (league: string, gameId: string | number) => `https://www.espn.com/${league}/game/_/gameId/${gameId}`;

export default declare({
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
		// @todo remove this typecast when context.invocation is a specific union in the future
		const league = context.invocation as "espn" | "nba" | "nfl" | "nhl" | "mlb";
		if (league === "espn") {
			return {
				success: false,
				reply: `Use one of the specific sports league aliases instead of the full command name! List: ${LEAGUES_LIST.join(", ")}`
			};
		}

		const mode = context.params.mode ?? "next";
		if (!isCommand(mode)) {
			return {
				success: false,
				reply: `Invalid mode provided! Use one of: ${ALLOWED_COMMAND_MODES.join(", ")}`
			};
		}

		const targetDate = (context.params.date)
			? new SupiDate(context.params.date)
			: new SupiDate(SupiDate.getTodayUTC());

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

		const data = espnSchema.parse(response.body);
		const leagueAbbr = league.toUpperCase();
		if (mode === "next") {
			const event = data.events
				.sort((a, b) => new SupiDate(a.date).valueOf() - new SupiDate(b.date).valueOf())
				.find(i => i.status.type.completed);

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
			if (event.status.clock !== 0) {
				statusString = ` Period ${event.status.period}, ${event.status.displayClock}`;
			}

			const link = createGamecastLink(league, event.id);
			const delta = core.Utils.timeDelta(new SupiDate(event.date));
			return {
				success: true,
				reply: `Next ${leagueAbbr} match: ${event.name} ${delta}${playedAtString}.${statusString} ${link}`
			};
		}
		else if (mode === "today") {
			const events = data.events
				.sort((a, b) => new SupiDate(a.date).valueOf() - new SupiDate(b.date).valueOf())
				.filter(i => !i.status.type.completed);

			if (events.length === 0) {
				return {
					success: false,
					reply: core.Utils.tag.trim `
						There are no upcoming ${leagueAbbr} matches for today!
						Check full info here: https://www.espn.com/${league}/scoreboard
					`
				};
			}

			const list = events.map(i => `${i.shortName} ${core.Utils.timeDelta(new SupiDate(i.date))}`);
			return {
				success: true,
				reply: `Upcoming ${leagueAbbr} matches: ${list.join("; ")}`
			};
		}
		else {
			const events = data.events
				.sort((a, b) => new SupiDate(a.date).valueOf() - new SupiDate(b.date).valueOf())
				.filter(i => i.status.type.completed);

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
	Dynamic_Description: (prefix) => [
		"Collection of commands related to North American leagues, as covered by the ESPN.",

		`<code>${prefix}nba</code>`,
		`<code>${prefix}nfl</code>`,
		`<code>${prefix}nhl</code>`,
		`<code>${prefix}mlb</code>`,
		`<code>${prefix}nba mode:next</code>`,
		"Shows the next upcoming match, depending on the league you selected.",
		"",

		`<code>${prefix}nba mode:today</code>`,
		`<code>${prefix}nfl mode:today</code>`,
		`<code>${prefix}nhl mode:today</code>`,
		`<code>${prefix}mlb mode:today</code>`,
		"Shows a summary of all upcoming matches for today.",
		"",

		`<code>${prefix}nba mode:scores</code>`,
		`<code>${prefix}nfl mode:scores</code>`,
		`<code>${prefix}nhl mode:scores</code>`,
		`<code>${prefix}mlb mode:scores</code>`,
		"Shows a summary of all today's finished matches along with their scores."
	]
});
