/**
 * Transformed to ES6 syntax by @supinic
 * Generated from https://translate.google.com *
 * The languages that Google Translate supports (as of 5/15/16) alongside with their ISO 639-1 codes
 * See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 */
module.exports = (function () {
	return class ISOLanguageParser {
		static getCode (string, targetCode = null) {
			const target = ISOLanguageParser.get(string);
			if (!target) {
				return null;
			}
			else if (targetCode) {
				return target[targetCode];
			}
			else {
				return target.iso6391 || target.iso6392;
			}
		}

		static getName (string) {
			const target = ISOLanguageParser.get(string);
			if (!target) {
				return null;
			}
			else {
				return target.names[0];
			}
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
			return ISOLanguageParser.languages.find(({iso6391, iso6392, names}) => (
				iso6391 === target || iso6392 === target || names.includes(target)
			));
		}

		/**
		 * Supported languages and their ISO codes
		 * @returns {Language[]}
		 */
		static get languages () {
			return [
				{ iso6391: "af", names: ["afrikaans"] },
				{ iso6391: "sq", names: ["albanian"] },
				{ iso6391: "am", names: ["amharic"] },
				{ iso6391: "ar", names: ["arabic"] },
				{ iso6391: "hy", names: ["armenian"] },
				{ iso6391: "az", names: ["azerbaijani"] },
				{ iso6391: "eu", names: ["basque"] },
				{ iso6391: "be", names: ["belarusian"] },
				{ iso6391: "bn", names: ["bengali"] },
				{ iso6391: "bs", names: ["bosnian"] },
				{ iso6391: "bg", names: ["bulgarian"] },
				{ iso6391: "ca", names: ["catalan"] },
				{ iso6392: "ceb", names: ["cebuano"] },
				{ iso6391: "ny", names: ["chichewa"] },
				// { iso6391: "zh", names: ["chinese"] },
				{ iso6391: "zh-cn", names: ["chinese"] },
				{ iso6391: "co", names: ["corsican"] },
				{ iso6391: "hr", names: ["croatian"] },
				{ iso6391: "cs", names: ["czech"] },
				{ iso6391: "da", names: ["danish"] },
				{ iso6391: "nl", names: ["dutch"] },
				{ iso6391: "en", names: ["english"] },
				{ iso6391: "eo", names: ["esperanto"] },
				{ iso6391: "et", names: ["estonian"] },
				{ iso6391: "tl", names: ["filipino"] },
				{ iso6391: "fi", names: ["finnish"] },
				{ iso6391: "fr", names: ["french"] },
				{ iso6391: "fy", names: ["frisian"] },
				{ iso6391: "gl", names: ["galician"] },
				{ iso6391: "ka", names: ["georgian"] },
				{ iso6391: "de", names: ["german"] },
				{ iso6391: "el", names: ["greek"] },
				{ iso6391: "gu", names: ["gujarati"] },
				{ iso6391: "ht", names: ["haitian creole"] },
				{ iso6391: "ha", names: ["hausa"] },
				{ iso6392: "haw", names: ["hawaiian"] },
				{ iso6391: "iw", names: ["hebrew"] },
				{ iso6391: "hi", names: ["hindi"] },
				{ iso6392: "hmn", names: ["hmong"] },
				{ iso6391: "hu", names: ["hungarian"] },
				{ iso6391: "is", names: ["icelandic"] },
				{ iso6391: "ig", names: ["igbo"] },
				{ iso6391: "id", names: ["indonesian"] },
				{ iso6391: "ga", names: ["irish"] },
				{ iso6391: "it", names: ["italian"] },
				{ iso6391: "ja", names: ["japanese"] },
				{ iso6391: "jw", names: ["javanese"] },
				{ iso6391: "kn", names: ["kannada"] },
				{ iso6391: "kk", names: ["kazakh"] },
				{ iso6391: "km", names: ["khmer"] },
				{ iso6391: "ko", names: ["korean"] },
				{ iso6391: "ku", names: ["kurdish", "kurmanji"] },
				{ iso6391: "ky", names: ["kyrgyz"] },
				{ iso6391: "lo", names: ["lao"] },
				{ iso6391: "la", names: ["latin"] },
				{ iso6391: "lv", names: ["latvian"] },
				{ iso6391: "lt", names: ["lithuanian"] },
				{ iso6391: "lb", names: ["luxembourgish"] },
				{ iso6391: "mk", names: ["macedonian"] },
				{ iso6391: "mg", names: ["malagasy"] },
				{ iso6391: "ms", names: ["malay"] },
				{ iso6391: "ml", names: ["malayalam"] },
				{ iso6391: "mt", names: ["maltese"] },
				{ iso6391: "mi", names: ["maori"] },
				{ iso6391: "mr", names: ["marathi"] },
				{ iso6391: "mn", names: ["mongolian"] },
				{ iso6391: "my", names: ["myanmar", "burmese"] },
				{ iso6391: "ne", names: ["nepali"] },
				{ iso6391: "no", names: ["norwegian"] },
				{ iso6391: "ps", names: ["pashto"] },
				{ iso6391: "fa", names: ["persian"] },
				{ iso6391: "pl", names: ["polish"] },
				{ iso6391: "pt", names: ["portuguese"] },
				{ iso6391: "ma", names: ["punjabi"] },
				{ iso6391: "ro", names: ["romanian"] },
				{ iso6391: "ru", names: ["russian"] },
				{ iso6391: "sm", names: ["samoan"] },
				{ iso6391: "gd", names: ["scots gaelic"] },
				{ iso6391: "sr", names: ["serbian"] },
				{ iso6391: "st", names: ["sesotho"] },
				{ iso6391: "sn", names: ["shona"] },
				{ iso6391: "sd", names: ["sindhi"] },
				{ iso6391: "si", names: ["sinhala"] },
				{ iso6391: "sk", names: ["slovak"] },
				{ iso6391: "sl", names: ["slovenian"] },
				{ iso6391: "so", names: ["somali"] },
				{ iso6391: "es", names: ["spanish"] },
				{ iso6391: "su", names: ["sundanese"] },
				{ iso6391: "sw", names: ["swahili"] },
				{ iso6391: "sv", names: ["swedish"] },
				{ iso6391: "tg", names: ["tajik"] },
				{ iso6391: "ta", names: ["tamil"] },
				{ iso6391: "te", names: ["telugu"] },
				{ iso6391: "th", names: ["thai"] },
				{ iso6391: "tr", names: ["turkish"] },
				{ iso6391: "uk", names: ["ukrainian"] },
				{ iso6391: "ur", names: ["urdu"] },
				{ iso6391: "uz", names: ["uzbek"] },
				{ iso6391: "vi", names: ["vietnamese"] },
				{ iso6391: "cy", names: ["welsh"] },
				{ iso6391: "xh", names: ["xhosa"] },
				{ iso6391: "yi", names: ["yiddish"] },
				{ iso6391: "yo", names: ["yoruba"] },
				{ iso6391: "zu", names: ["zulu"] }
			];
		}
	};
})();

/**
 * @typedef {Object} Language
 * @property {string} iso6391
 * @property {string} iso6392
 * @property {string[]} names
 */