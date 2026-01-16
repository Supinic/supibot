import { it, describe } from "node:test";
import assert from "node:assert";
import * as z from "zod";

import rawCopypastas from "./subcommands/copypasta.json" with { type: "json" };
import rawKimiQuotes from "./subcommands/kimi.json" with { type: "json" };

const jsonSchema = z.array(z.string());

describe("command: f1", () => {
	it("should not have any duplicate copypastas", () => {
		const copypastas = jsonSchema.parse(rawCopypastas);
		const duplicates = copypastas.filter((i, ind, arr) => arr.indexOf(i) !== ind);
		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});

	it("should not have any duplicate Kimi Räikkönen quotes", () => {
		const kimiQuotes = jsonSchema.parse(rawKimiQuotes);
		const duplicates = kimiQuotes.filter((i, ind, arr) => arr.indexOf(i) !== ind);
		assert.strictEqual(duplicates.length, 0, `There are duplicates:\n${duplicates.join("\n")}`);
	});
});
