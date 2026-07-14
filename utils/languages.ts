import * as z from "zod";
// Generated from https://translate.google.com
import rawLanguages from "./languages-data.json" with { type: "json" };

const schema = z.array(z.object({
	group: z.string(),
	names: z.array(z.string()).min(1),
	iso6391: z.string().lowercase().nullable(),
	iso6392: z.string().lowercase().nullable(),
	iso6393: z.string().lowercase().nullable(),
	glottolog: z.string().lowercase().optional(),
	deprecated: z.object({ iso6391: z.string().lowercase() }).optional()
}));

export type LanguageDefinition = z.infer<typeof schema>[number];
const languages = schema.parse(rawLanguages);

type IsoCode = "iso6391" | "iso6392" | "iso6393";

/**
 * Returns the full definition of a language, or undefined if none was found
 */
export const getDefinition = (string: string): LanguageDefinition | null => {
	const target = string.toLowerCase();
	return languages.find(i => (
		(i.iso6391 === target)
		|| (i.iso6392 === target)
		|| (i.iso6393 === target)
		|| (Array.isArray(i.names) && i.names.includes(target))
		|| (i.deprecated && Object.values(i.deprecated).includes(target))
	)) ?? null;
};

export const hasDefinition = (string: string): boolean => {
	const definition = getDefinition(string);
	return Boolean(definition);
};

export const getCode = (string: string, targetCode: IsoCode = "iso6391") => {
	const target = getDefinition(string);
	return (target) ? target[targetCode] : null;
};

export const getName = (string: string) => {
	const target = getDefinition(string);
	return (target) ? target.names[0] : null;
};
