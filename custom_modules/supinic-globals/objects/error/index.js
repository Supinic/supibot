module.exports = (function () {
	const result = Object.create(null);
	result.name = "error";

	const types = [
		"api.js"
	];

	for (const file of types) {
		try {
			const mod = require("./" + file);
			result[mod.name] = mod;
			console.log("Error module " + file + " imported", result);
		}
		catch (e) {
			console.log("Import of error module " + file + " failed", e.message);
		}
	}

	return result;
})();