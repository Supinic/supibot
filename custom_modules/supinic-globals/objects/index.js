/* global sb */
module.exports = (function () {
	"use strict";

	const files = [
		"date",
		"error",
		"url-params",
		"promise"
	];

	for (const file of files) {
		try {
			const mod = require("./" + file);
			sb[mod.name] = mod;
			console.log("Object module " + file + " imported");
		}
		catch (e) {
			console.log("Import of object module " + file + " failed", e.message);
		}
	}
})();

