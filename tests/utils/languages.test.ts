import * as z from "zod";
import * as assert from "node:assert";
import { it, test, describe } from "node:test";

import { getCode, getName } from "../../utils/languages.ts";
import rawLanguages from "../../utils/languages-data.json" with { type: "json" };

// partially duplicated with `utils/languages.ts`, but omits properties we don't care about for testing
const schema = z.array(z.object({
	names: z.array(z.string()).min(1),
	iso6391: z.string().nullable(),
	iso6392: z.string().nullable(),
	iso6393: z.string().nullable(),
	deprecated: z.object({ iso6391: z.string() }).optional(),
	variants: z.array(z.object({
		names: z.array(z.string()).min(1),
		bcp47: z.string()
	})).optional()
}));

const languages = schema.parse(rawLanguages);
const normalize = (string: string) => string.normalize("NFKD").trim().toLowerCase();

test("language identifiers are globally unique", () => {
	const map = new Map<string, string>();
	const check = (value: string | null | undefined, owner: string) => {
		if (!value) {
			return;
		}

		const normalized = normalize(value);
		const existing = map.get(normalized);
		if (existing && existing !== owner) {
			assert.fail(`Language identifier "${value}" exists under ${owner} and ${existing}`);
		}

		map.set(normalized, owner)
	}

	for (const language of languages) {
		const main = language.names[0];
		for (const name of language.names) {
			check(name, main);
		}

		check(language.iso6391, main);
		check(language.iso6392, main);
		check(language.iso6393, main);
		check(language.deprecated?.iso6391, main);

		if (!language.variants) {
			continue;
		}

		for (const variant of language.variants) {
			const variantMain = `${main}/${variant.names[0]}`;
			for (const name of variant.names) {
				check(name, variantMain);
			}

			check(variant.bcp47, variantMain);
		}
	}
})

describe("sanity checks", () => {
	it("looks up a base language (English)", () => {
		const name = getName("en");
		assert.strictEqual(name, "English");

		const code = getCode("English");
		assert.strictEqual(code, "en");
	});

	it("looks up a variant (Swiss German)", () => {
		const name = getName("de-ch");
		assert.strictEqual(name, "Swiss German");

		const code = getCode("Swiss");
		assert.strictEqual(code, "de-ch");
	});
});
