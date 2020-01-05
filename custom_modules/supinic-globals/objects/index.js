/* global sb */
module.exports = (function () {
	"use strict";

	const files = [
		"date",
		"error.js",
		"error/index.js",
		"url-params",
		"promise"
	];

	console.groupCollapsed("objects load");
	for (const file of files) {
		try {
			const start = process.hrtime.bigint();
			const mod = require("./" + file);
			sb[mod.name] = mod;
			const time = Number(process.hrtime.bigint() - start);

			console.log("Object module " + file + " imported in " + Math.trunc(time / 1.0e6) + " ms");
		}
		catch (e) {
			console.log("Import of object module " + file + " failed", e.message);
		}
	}
	console.groupEnd();
})();

