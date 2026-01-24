import { declare } from "../../classes/command.js";
import { getTwitchGameID } from "../../utils/command-utils.js";
import { twitchStreamSchema } from "../../utils/schemas.js";

export default declare({
	Name: "topstreams",
	Aliases: null,
	Cooldown: 30000,
	Description: "Checks the top 10 streams on Twitch - if you add a game, will look for the top 10 streams playing that game. The game must be provided verbatim.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function topStreams (context, ...args) {
		const searchParams: Record<string, string> = { limit: "10" };
		if (args.length > 0) {
			const games = await getTwitchGameID(args.join(" "));
			const game = games.at(0);
			if (!game) {
				return {
					success: false,
					reply: `Provided game is not available on Twitch! You must use an exact match.`
				};
			}

			searchParams.game_id = game.id;
		}

		const response = await core.Got.get("Helix")({
			url: "streams",
			searchParams
		});

		const { data } = twitchStreamSchema.parse(response.body);
		if (!response.ok || data.length === 0) {
			return {
				reply: ("game_id" in searchParams)
					? "Nobody is playing that game right now."
					: "Nobody is playing anything on Twitch right now. (?!)"
			};
		}

		let gameString;
		if (searchParams.game) {
			gameString = `are playing ${data[0].game_name}`;
		}
		else {
			gameString = "are live";
		}

		const streamers = data.map(stream => {
			const specificGame = (!searchParams.game_id)
				? `- ${stream.game_name}`
				: "";

			return `@${stream.user_login} ${specificGame} (${core.Utils.groupDigits(stream.viewer_count)})`;
		});

		return {
			reply: `These streamers ${gameString}: ${streamers.join("; ")}`
		};
	}),
	Dynamic_Description: (prefix) => [
		"Fetches the top 10 streamers currently live on Twitch, sorted by viewers descending.",
		"If you provide a game, only that game's streams will be shown.",
		"",

		`<code>${prefix}topstreams</code>`,
		"Shows the top streamers currently live",
		"",

		`<code>${prefix}topstreams (game)</code>`,
		`<code>${prefix}topstreams Old School Runescape</code>`,
		"Shows the top streamers currently live in that game or category."
	]
});
