const subcommands = [
	require(`./buy.js`),
	require(`./fish.js`),
	require(`./help.js`),
	require(`./sell.js`),
	require(`./show.js`)
];

module.exports = {
	subcommands
};
