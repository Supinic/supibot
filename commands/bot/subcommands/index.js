const subcommands = [
	require("./banphrase-api.js"),
	require("./check-live.js"),
	require("./enable-rustlog.js"),
	require("./global-emotes.js"),
	require("./links.js"),
	require("./offline-only.js"),
	require("./rejoin.js"),
	require("./rename.js"),
	require("./toggle.js")
];

export default {
	subcommands
};
