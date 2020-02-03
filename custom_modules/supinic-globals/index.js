module.exports = (async function (namespace = "sb", options = {}) {
	global[namespace] = {};

	const SingletonTemplate = require("./singleton-template");
	const files = [
		"objects/date",
		"objects/error",
		"objects/promise",
		"objects/url-params",

		"singletons/query",
		"classes/config",
		"singletons/utils",
		"singletons/cooldown-manager",
		"singletons/logger",
		"singletons/system-log",
		"singletons/vlc-connector",
		"singletons/twitter",
		"singletons/internal-request",
		"singletons/extra-news",
		"singletons/local-request",
		"singletons/runtime",
		"singletons/pastebin",

		"classes/platform",
		"classes/filter",
		"classes/command",
		"classes/channel",
		"classes/user",
		"classes/afk",
		"classes/banphrase",
		"classes/reminder",
		"classes/cron",
		"classes/markov-chain",
	];

	const { blacklist, whitelist } = options;

	console.groupCollapsed("module load performance");

	for (const file of files) {
		if (blacklist && blacklist.includes(file)) {
			continue;
		}
		else if (whitelist && !whitelist.includes(file)) {
			continue;
		}

		const start = process.hrtime.bigint();
		const [type] = file.split("/");
		let component = require("./" + file);

		if (type === "objects") {
			global[namespace][component.name] = component;
		}
		else if (type === "singletons") {
			component = component(SingletonTemplate);
			global[namespace][component.name] = await component.singleton();
		}
		else if (type === "classes") {
			global[namespace][component.name] = await component.initialize();
		}

		const end = process.hrtime.bigint();
		console.log(component.name + " loaded in " + Number(end - start) / 1.0e6 + " ms");
	}

	console.groupEnd();
});