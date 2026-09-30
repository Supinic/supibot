import * as z from "zod";
import rawLanguages from "./languages-data.json" with { type: "json" };

const variantSchema = z.object({
	names: z.array(z.string()).min(1),
	bcp47: z.string().lowercase()
});
const schema = z.array(z.object({
	group: z.string(),
	names: z.array(z.string()).min(1),
	iso6391: z.string().lowercase().nullable(),
	iso6392: z.string().lowercase().nullable(),
	iso6393: z.string().lowercase().nullable(),
	glottolog: z.string().lowercase().optional(),
	deprecated: z.object({ iso6391: z.string().lowercase() }).optional(),
	variants: z.array(variantSchema).optional()
}));

type IsoCode = "iso6391" | "iso6392" | "iso6393";
type Code = IsoCode | "bcp47";

type LanguageVariant = z.infer<typeof variantSchema>;
export type LanguageDefinition = z.infer<typeof schema>[number];
type LanguageResolution = {
	definition: LanguageDefinition;
	variant: LanguageVariant | null;
};

const normalize = (string: string) => string.normalize("NFKD").trim().toLowerCase();
const languages = schema.parse(rawLanguages).map(def => ({
	...def,
	normalizedNames: def.names.map(i => normalize(i)),
	variants: def.variants?.map(variant => ({
		...variant,
		normalizedNames: variant.names.map(i => normalize(i))
	}))
}));

const resolve = (string: string): LanguageResolution | null => {
	const target = normalize(string);
	const definition = languages.find(i => (
		(i.iso6391 === target)
		|| (i.iso6392 === target)
		|| (i.iso6393 === target)
		|| i.normalizedNames.includes(target)
		|| (i.deprecated && Object.values(i.deprecated).includes(target))
	));

	if (definition) {
		return {
			definition,
			variant: null
		};
	}

	for (const definition of languages) {
		if (!definition.variants) {
			continue;
		}

		const variant = definition.variants.find(i => i.bcp47 === target || i.normalizedNames.includes(target));
		if (variant) {
			return { definition, variant };
		}
	}

	return null;
};

export const getDefinition = (string: string): LanguageDefinition | null => {
	const target = resolve(string);
	return target?.definition ?? null;
};

export const hasDefinition = (string: string): boolean => {
	const definition = getDefinition(string);
	return Boolean(definition);
};

export const getCode = (string: string, targetCode?: Code): string | null => {
	const target = resolve(string);
	if (!target) {
		return null;
	}

	if (target.variant) {
		return (!targetCode || targetCode === "bcp47") ? target.variant.bcp47 : null;
	}
	else {
		if (targetCode === "bcp47") {
			return null;
		}

		const { definition } = target;
		if (targetCode) {
			return definition[targetCode] ?? null;
		}
		else {
			return definition.iso6391 ?? definition.iso6392 ?? definition.iso6393 ?? null;
		}
	}
};

export const getName = (string: string): string | null => {
	const target = resolve(string);
	if (!target) {
		return null;
	}

	const { names } = target.variant ?? target.definition;
	return names[0];
};
