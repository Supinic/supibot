const types = [
	"active-chatters",
	"afk-longest",
	"afk",
	"alias-names",
	"aliases",
	"cookie-count",
	"markov",
	"playsounds",
	"reminders",
	"song-requests",
	"suggestions",
	"supibot",
	"twitch-lotto"
];

const definitions = [];
module.exports = function loadStatisticsTypes () {
	if (definitions.length !== 0) {
		return definitions;
	}

	for (const file of types) {
		let definition;
		try {
			definition = require(`./types/${file}.js`);
		}
		catch (e) {
			console.warn("Could not load stat", { file, e });
			continue;
		}

		if (!definition || typeof definition !== "object") {
			continue;
		}

		definitions.push(definition);
	}

	return definitions;
};
