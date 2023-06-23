const subcommands = [
	require(`./buy.js`),
	require(`./fish.js`),
	require(`./leaderboard.js`),
	require(`./sell.js`),
	require(`./show.js`),
	require(`./stats.js`)
];

module.exports = {
	subcommands
};
