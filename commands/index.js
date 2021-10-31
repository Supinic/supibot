module.exports = (async () => {
	const fs = require("fs/promises");
	const path = require("path");

	const config = require("./config.json");
	const blacklist = config?.blacklist ?? [];
	const whitelist = config?.whitelist ?? [];

	if (blacklist.length > 0 && whitelist.length > 0) {
		throw new Error("Cannot combine both blacklist and whitelist options");
	}

	const nodeList = await fs.readdir(__dirname, {
		withFileTypes: true
	});

	const definitions = [];
	const failed = [];
	const skipped = [];

	const directoryList = nodeList.filter(i => i.isDirectory());
	for (const dir of directoryList) {
		if (blacklist.length > 0 && blacklist.includes(dir.name)) {
			skipped.push(dir.name);
			continue;
		}
		else if (whitelist.length > 0 && !whitelist.includes(dir.name)) {
			skipped.push(dir.name);
			continue;
		}

		const indexPath = path.join(__dirname, dir.name, "index.js");
		try {
			const definition = require(indexPath);
			definitions.push(definition);
		}
		catch {
			failed.push(dir.name);
		}
	}

	return {
		definitions,
		failed,
		skipped
	};
})();
