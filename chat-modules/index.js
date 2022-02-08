const fs = require("fs/promises");
const path = require("path");

module.exports = (async () => {
	const nodeList = await fs.readdir(__dirname, {
		withFileTypes: true
	});

	const definitions = [];
	const failed = [];

	const directoryList = nodeList.filter(i => i.isDirectory());
	for (const dir of directoryList) {
		let definition;
		const indexPath = path.join(__dirname, dir.name, "index.js");
		try {
			definition = require(indexPath);
		}
		catch {
			failed.push(dir.name);
		}

		if (definition) {
			definitions.push(definition);
		}
	}

	return {
		definitions,
		failed
	};
})();
