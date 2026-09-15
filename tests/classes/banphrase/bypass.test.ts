import * as assert from "node:assert";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { Command, type ParameterType } from "../../../classes/command.js";
import { Banphrase } from "../../../classes/banphrase.js";

describe("Whitespace bypass checking", async () => {
	const banphrase = new Banphrase({
		ID: 1,
		Channel: null,
		Platform: null,
		Type: "Replacement",
		Active: true,
		Code: `(msg) => msg.replace(/^\s*!/, "X")`
	});

	for (let i = 0; i < 65535; i++) {
		const char = String.fromCodePoint(i);
		const result = await banphrase.execute(`${char}!help`);

		assert.ok(result);
		assert.ok(typeof result === "string");
		assert.ok(!result.startsWith("!"));
	}
});
