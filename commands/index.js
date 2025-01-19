const loadCommands = (async (config) => {
	const fs = require("node:fs/promises");
	const path = require("node:path");

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

		let definition;
		const indexPath = path.join(__dirname, dir.name, "index.js");
		try {
			definition = require(indexPath);
		}
		catch (e) {
			console.warn(`Could not load command ${dir.name}`, e);
			failed.push(dir.name);
		}

		if (definition) {
			const definitionFlags = definition.flags ?? definition.Flags ?? [];
			if (config.skipArchivedCommands && definitionFlags.includes("archived")) {
				skipped.push(definition);
			}
			else {
				definitions.push(definition);
			}
		}
	}

	return {
		definitions,
		failed,
		skipped
	};
});

export default {
	loadCommands
};
