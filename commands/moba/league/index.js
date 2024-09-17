module.exports = {
	requiredEnvs: ["API_RIOT_GAMES_KEY"],
	subcommands: [
		require("./last-match.js"),
		require ("./rank.js")
	]
};
