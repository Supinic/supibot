/* eslint-disable max-nested-callbacks */
const assert = require("node:assert");

describe("command: f1", () => {
	it("should not have any duplicate copypastas", () => {
		const pastas = require("./subcommands/copypasta.json");
		const duplicates = pastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);

		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});

	it("should not have any duplicate Kimi Räikkönen quotes", () => {
		const pastas = require("./subcommands/kimi.json");
		const duplicates = pastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);

		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});
});
