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

	debugger;
	for (const file of files) {
		try {
			const mod = require("./" + file);
			sb[mod.name] = mod;
			console.log("Object module " + file + " imported", mod, mod.name, sb);
		}
		catch (e) {
			console.log("Import of object module " + file + " failed", e.message);
		}
	}
})();

