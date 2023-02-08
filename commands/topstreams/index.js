module.exports = {
	Name: "topstreams",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Checks the top 10 streams on Twitch - if you add a game, will look for the top 10 streams playing that game. The game must be provided verbatim.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topStreams (context, ...args) {
		const searchParams = { limit: "10" };
		if (args.length > 0) {
			const name = args.join(" ");
			const response = await sb.Got("Helix", {
				url: "games",
				searchParams: { name }
			});

			if (response.statusCode !== 200 || response.body.data.length === 0) {
				return {
					success: false,
					reply: `Provided game is not available on Twitch! Must use an exact match.`
				};
			}

			searchParams.game_id = response.body.data[0].id;
		}

		const response = await sb.Got("Helix", {
			url: "streams",
			searchParams
		});

		if (response.statusCode !== 200 || response.body.data.length === 0) {
			return {
				reply: (searchParams.game)
					? "Nobody is playing that game right now."
					: "Nobody is playing anything on Twitch right now. (?!)"
			};
		}

		const { data } = response.body;

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

			return `@${stream.user_login} ${specificGame} (${sb.Utils.groupDigits(stream.viewer_count)})`;
		});

		return {
			reply: `These streamers ${gameString}: ${streamers.join("; ")}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches the top 10 streamers currently live on Twitch, sorted by viewers descending.",
		"If you provide a game, only that game's streams will be shown.",
		"",

		`<code>${prefix}topstreams</code>`,
		"Shows the top streamers currently live",
		"",


		`<code>${prefix}topstreams (game)</code>`,
		`<code>${prefix}topstreams Old School Runescape</code>`,
		"Shows the top streamers currently live in that game or category."
	])
};
