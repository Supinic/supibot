module.exports = {
	Name: "topstreams",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Checks the top 5 streams on twitch - if you add a game, will look for top 5 streams playing that game. Game must be provided verbatim",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function topStreams (context, ...args) {
		const searchParams = { limit: "10" };
		if (args.length > 0) {
			searchParams.game = args.join(" ");
		}

		const data = await sb.Got("Kraken", {
			url: "streams",
			searchParams
		}).json();
	
		if (data._total === 0) {
			return {
				reply: (searchParams.game)
					? "Nobody is playing that game right now."
					: "Nobody is playing anything on Twitch right now. (?!)"
			};
		}
		else {
			let gameString;
			if (searchParams.game) {
				gameString = "are playing " + data.streams[0].game;
			}
			else {
				gameString = "are live";
			}
	
			const streamers = data.streams.map(stream => {
				const specificGame = (!searchParams.game)
					? `- ${stream.game}`
					: "";

				return `@${stream.channel.name} ${specificGame} (${stream.viewers})`;
			});
	
			return {
				reply: `These streamers ${gameString}: ${streamers.join("; ")}`
			};
		}
	}),
	Dynamic_Description: null
};