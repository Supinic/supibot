module.exports = (async function (required) {
	"use strict";

	global.sb = {};

	const directories = required || ["objects", "singletons", "classes"];
	for (const directory of directories) {
		await require("./" + directory);
	}
});