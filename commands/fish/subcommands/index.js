const subcommands = [
	require(`./buy.js`),
	require(`./config.js`),
	require(`./fish.js`),
	require(`./leaderboard.js`),
	require(`./sell.js`),
	require(`./show.js`),
	require(`./stats.js`),
	require(`./trap.js`)
];

export default {
	subcommands
};
