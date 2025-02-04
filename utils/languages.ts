import rawLanguages from "./languages-data.json" with { type: "json" };
const languages = rawLanguages as LanguageDefinition[];

type NameDescriptor = {
	native: {
		short: string;
		long: string;
	};
	english: {
		short: string;
		long: string;
	};
	transliterations: string[];
	other: string[];
};
type LanguageDefinition = {
	name: string;
	group: string;
	names: string[] | NameDescriptor;
	iso6391: string;
	iso6392: string;
	iso6393: string;
	glottolog?: string;
	deprecated?: string;
};

type IsoCode = "iso6391" | "iso6392" | "iso6393";
type IsoType = 1 | 2 | 3;

const compileNameList = (lang: NameDescriptor) => [
	...Object.values(lang.english),
	...Object.values(lang.native),
	...lang.transliterations,
	...lang.other
];

/**
 * Transformed to ES6 syntax by @supinic
 * Generated from https://translate.google.com *
 * The languages that Google Translate supports (as of 5/15/16) alongside with their ISO 639-1 codes
 * See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 */
export class Language {
	#name: string;
	#glottolog;
	#isoCodes: [string, string, string];
	#aliases: string[] = [];

	constructor (data: LanguageDefinition) {
		this.#name = data.name;
		this.#isoCodes = [data.iso6391, data.iso6392, data.iso6393];

		if (Array.isArray(data.names)) {
			this.#aliases.push(...data.names);
		}
		else if (typeof data.names === "object") {
			const { native, english, transliterations, other } = data.names;
			this.#aliases.push(
				native.short,
				native.long,
				english.short,
				english.long,
				...transliterations,
				...other
			);
		}

		if (data.glottolog) {
			this.#glottolog = data.glottolog;
		}
	}

	getIsoCode (type: IsoType): string | undefined {
		const index = type - 1;
		return this.#isoCodes[index];
	}

	get name (): string { return this.#name; }
	get aliases (): string[] { return this.#aliases; }
	get glottolog () { return this.#glottolog; }
}

export class LanguageParser {
	static getCode (string: string, targetCode: IsoCode = "iso6391") {
		const target = LanguageParser.get(string);
		if (!target) {
			return null;
		}
		else if (targetCode) {
			return target[targetCode];
		}
	}

	static getName (string: string) {
		const target = LanguageParser.get(string);
		if (!target) {
			return null;
		}
		else {
			return (!target.name && Array.isArray(target.names))
				? target.names[0]
				: target.name;
		}
	}

	/**
	 * Fetches a Language class instance for provided input
	 * @param string language-like code, name or ISO code
	 */
	static getLanguage (string: string) {
		const result = LanguageParser.get(string);
		if (!result) {
			return null;
		}

		return new Language(result);
	}

	/**
	 * Returns the full definition of language, or null if none was found
	 * @param string name or the code of the desired language
	 */
	static get (string: string) {
		const target = string.toLowerCase();
		return LanguageParser.languages.find(i => (
			(i.iso6391 === target)
			|| (i.iso6392 === target)
			|| (i.iso6393 === target)
			|| (Array.isArray(i.names) && i.names.includes(target))
			|| (i.deprecated && Object.values(i.deprecated).includes(target))
		));
	}

	/**
	 * Searches by all names in a language.
	 */
	static search (string: string) {
		const target = string.toLowerCase();
		const result = LanguageParser.languages.find(lang => {
			const names = (Array.isArray(lang.names))
				? lang.names
				: compileNameList(lang.names);

			return names.includes(target);
		});

		return result ?? null;
	}

	/**
	 * Supported languages and their ISO codes
	 * @returns {Language[]}
	 */
	static get languages (): LanguageDefinition[] {
		return languages;
	}
}
