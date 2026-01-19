import { it, describe } from "node:test";
import { ok } from "node:assert";

describe("overall command structure", () => {
	it("imports all commands successfully", async () => {
		const definitions = await import("../../commands/index.js");
		ok(Array.isArray(definitions.default));
	});
});
