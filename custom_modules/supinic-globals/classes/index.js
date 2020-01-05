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

	console.groupCollapsed("classes load");
	for (const target of Object.values(modules)) {
		try {
			const start = process.hrtime.bigint();
			const mod = await require("./" + target);
			sb[mod.name] = await mod.initialize();
			const time = Number(process.hrtime.bigint() - start);

			console.log("Database class module " + target + " imported in " + Math.trunc(time / 1.0e6) + " ms");
		}
		catch (e) {
			console.log("Import of database class module " + target + " failed", e);
		}
	}
	console.groupEnd();
})();