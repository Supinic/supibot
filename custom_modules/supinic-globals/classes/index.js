/* global sb */
/**
 * Super-class for any static modules implemented
 * @memberof sb
 * @namespace StaticModule
 */
module.exports = (async function () {
	"use strict";

	const modules = {
		Platform: "platform",
		Filter: "filter",
		Command: "command",
		Channel: "channel",
		User: "user",
		AwayFromKeyboard: "afk",
		Banphrase: "banphrase",
		Reminder: "reminder",
		Cron: "cron",
		MarkovChain: "markov-chain"
	};

	for (const target of Object.values(modules)) {
		try {
			const mod = await require("./" + target);
			sb[mod.name] = await mod.initialize();
			console.log("Database class module " + target + " imported");
		}
		catch (e) {
			console.log("Import of database class module " + target + " failed", e);
		}
	}
})();