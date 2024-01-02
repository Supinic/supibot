const NBA_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const createGamecastLink = (gameId) => `https://www.espn.com/nba/game/_/gameId/${gameId}`;

const ALLOWED_MODES = ["next", "today"];

module.exports = {
	Name: "nba",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Shows info related to upcoming NBA matches.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "mode", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: async function nba (context) {
		const mode = context.params.mode ?? "next";
		if (!ALLOWED_MODES.includes(mode)) {
			return {
				success: false,
				reply: `Invalid mode provided! Use one of: ${ALLOWED_MODES.join(", ")}`
			};
		}

		const dates = new sb.Date(sb.Date.getTodayUTC()).format("Ymd");
		const response = await sb.Got("GenericAPI", {
			url: NBA_URL,
			searchParams: { dates }
		});

		if (mode === "next") {
			const event = response.body.events
				.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
				.find(i => i.status.type.completed !== true);

			if (!event) {
				return {
					success: false,
					reply: `No upcoming NBA event is currently scheduled!`
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

			const link = createGamecastLink(event.id);
			const delta = sb.Utils.timeDelta(new sb.Date(event.date));
			return {
				reply: `Next match: ${event.name} ${delta}${playedAtString}.${statusString} ${link}`
			};
		}
		else if (mode === "today") {
			const events = response.body.events
				.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
				.filter(i => i.status.type.completed !== true);

			const list = events.map(i => `${i.shortName} ${sb.Utils.timeDelta(new sb.Date(i.date))}`);
			return {
				reply: `Matches scheduled for today: ${list.join("; ")}`
			};
		}
	},
	Dynamic_Description: () => ([
		"Collection of commands related to NBA",

		`<code>$nba</code>`,
		`<code>$nba mode:next</code>`,
		"Shows the next upcoming match.",
		"",

		`<code>$nba mode:today</code>`,
		"Shows a summary of all upcoming matches for today (North American timezone)"
	])
};
