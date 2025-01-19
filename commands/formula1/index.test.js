/* eslint-disable max-nested-callbacks */
import assert from "node:assert";

describe("command: f1", () => {
	it("should not have any duplicate copypastas", () => {
		import pastas from "./subcommands/copypasta.json";
		const duplicates = pastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);

		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});

	it("should not have any duplicate Kimi Räikkönen quotes", () => {
		import pastas from "./subcommands/kimi.json";
		const duplicates = pastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);

		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});
});
