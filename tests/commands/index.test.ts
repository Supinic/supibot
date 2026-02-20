import * as z from "zod";
import { it, describe } from "node:test";
import { ok } from "node:assert";

const cooldownSchema = z.object({
	Cooldown: z.int().min(0).max(1e6)
});

describe("overall command structure", () => {
	it("imports all commands successfully", async () => {
		const definitions = await import("../../commands/index.js");
		ok(Array.isArray(definitions.default));

		for (const definition of definitions.default) {
			cooldownSchema.parse(definition);
		}
	});
});
