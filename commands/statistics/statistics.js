const fs = require("fs/promises");
const exactProperties = ["name", "aliases", "description", "execute"];
const definitions = [];

module.exports = async function loadStatisticsTypes () {
	if (definitions.length !== 0) {
		return definitions;
	}

	const files = await fs.readdir("./types");
	const statsFiles = files.filter(i => i.endsWith(".js"));

	for (const file of statsFiles) {
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
		else if (exactProperties.some(i => !Object.hasOwn(definition, i))) {
			continue;
		}
		else if (Object.keys(definition).some(i => !exactProperties.includes(i))) {
			continue;
		}
		else if (typeof definition.execute !== "function") {
			continue;
		}

		definitions.push(definition);
	}

	return definitions;
};
