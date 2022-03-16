/* eslint-disable max-nested-callbacks */
const assert = require("assert");

describe("command: f1", () => {
	it("should not have any duplicate copypastas", () => {
		const pastas = require("./copypasta.json");
		const duplicates = pastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);

		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});
});
