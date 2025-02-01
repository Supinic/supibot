import languages from "./languages-data.json" with { type: "json" };

/**
 * Transformed to ES6 syntax by @supinic
 * Generated from https://translate.google.com *
 * The languages that Google Translate supports (as of 5/15/16) alongside with their ISO 639-1 codes
 * See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 */
export default (function () {
	const compileNameList = (lang) => [
		...Object.values(lang.names.english),
		...Object.values(lang.names.native),
		...lang.names.transliterations,
		...lang.names.other
	];

	class Language {
		#name;
		#glottolog = null;
		#isoCodes = [];
		#aliases = [];

		constructor (data) {
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

		getIsoCode (type) {
			if (type !== 1 && type !== 2 && type !== 3) {
				throw new Error("Invalid ISO type provided, use a number: 1, 2, or 3");
			}

			const index = type - 1;
			return this.#isoCodes[index];
		}

		get name () { return this.#name; }
		get aliases () { return this.#aliases; }
		get glottolog () { return this.#glottolog; }
	}

	return class Parser {
		static getCode (string, targetCode = "iso6391") {
			const target = Parser.get(string);
			if (!target) {
				return null;
			}
			else if (targetCode) {
				return target[targetCode];
			}
		}

		static getName (string) {
			const target = Parser.get(string);
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
		 * @param {string} string Language-like code, name or ISO code
		 * @returns {Language|null}
		 */
		static getLanguage (string) {
			const result = Parser.get(string);
			if (!result) {
				return null;
			}

			return new Language(result);
		}

		/**
		 * Returns the full definition of language, or null if none was found
		 * @param {string} string – the name or the code of the desired language
		 * @returns {Language|null} Language definition, or null if not found
		 */
		static get (string) {
			if (typeof string !== "string") {
				return null;
			}

			const target = string.toLowerCase();
			return Parser.languages.find(i => (
				(i.iso6391 === target)
				|| (i.iso6392 === target)
				|| (i.iso6393 === target)
				|| (Array.isArray(i.names) && i.names.includes(target))
				|| (i.deprecated && Object.values(i.deprecated).includes(target))
			));
		}

		/**
		 * Searches by all names in a language.
		 * @param string
		 * @returns {Language|null}
		 */
		static search (string) {
			if (typeof string !== "string") {
				return null;
			}

			const target = string.toLowerCase();
			const result = Parser.languages.find(lang => {
				const names = (Array.isArray(lang.names))
					? lang.names
					: compileNameList(lang);

				return names.includes(target);
			});

			return result || null;
		}

		/**
		 * Supported languages and their ISO codes
		 * @returns {Language[]}
		 */
		static get languages () {
			return languages;
		}
	};
})();

/**
 * @typedef {Object} Language
 * @property {string} iso6391
 * @property {string} iso6392
 * @property {string[]} names
 */
