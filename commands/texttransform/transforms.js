import { randomInt } from "../../utils/command-utils.js";
import textCaseCode from "./text-case-code.js";
import officialCharactersMap from "./definitions/official-characters.json" with { type: "json" };

import BubbleDefinition from "./definitions/bubble.json" with { type: "json" };
import FancyDefinition from "./definitions/fancy.json" with { type: "json" };
import UpsideDownDefinition from "./definitions/upside-down.json" with { type: "json" };
import LeetDefinition from "./definitions/leet.json" with { type: "json" };
import MedievalDefinition from "./definitions/medieval.json" with { type: "json" };
import RunicDefinition from "./definitions/runic.json" with { type: "json" };
import SuperscriptDefinition from "./definitions/superscript.json" with { type: "json" };
import VaporwaveDefinition from "./definitions/vaporwave.json" with { type: "json" };

import MorseData from "./definitions/morse.json" with { type: "json" };

import LingoCockneyDefinition from "./lingo-translations/cockney.json" with { type: "json" };
import LingoCowboyDefinition from "./lingo-translations/cowboy.json" with { type: "json" };
import LingoOutbackDefinition from "./lingo-translations/outback.json" with { type: "json" };

const ANTI_PING_CHARACTER = "\u{E0000}";

const convert = {
	method: (string, fn, context) => fn(string, context),
	map: (string, map) => [...string].map(i => map[i] || i).join(""),
	unmap: (string, map) => {
		const reverseMap = {};
		for (const [key, value] of Object.entries(map)) {
			reverseMap[value] = key;
		}
		return convert.map(string, reverseMap);
	},
	translate: (string, dictionary) => {
		for (const [from, to] of dictionary.phrasesWords) {
			const r = new RegExp(`\\b${from}\\b`, "gi");
			string = string.replace(r, `_${to}_`);
		}

		for (const [from, to] of dictionary.prefixes) {
			const r = new RegExp(`\\b${from}`, "gi");
			string = string.replace(r, to);
		}

		for (const [from, to] of dictionary.suffixes) {
			const r = new RegExp(`${from}\\b`, "gi");
			string = string.replace(r, to);
		}

		for (const [from, to] of dictionary.intrawords) {
			const r = new RegExp(from, "gi");
			string = string.replace(r, to);
		}

		string = string.trim().replaceAll("_", "");

		if (dictionary.endings && /[).?!]$/.test(string)) {
			string += ` ${core.Utils.randArray(dictionary.endings)}`;
		}

		return string;
	}
};


/**
 * @typedef {Record<string, string>} TextTransformMap
 */

/**
 * @typedef {Object} TextTransformDictionary
 * @property {[string, string]} phrasesWords
 * @property {[string, string]} suffixes
 * @property {[string, string]} prefixes
 * @property {[string, string]} intraWords
 * @property {[string, string]} [endings]
 */

/**
 * @typedef {Function} TextTransformFunction
 * @param {string} message
 * @returns {string}
 */

/**
 * @typedef {Object} TextTransformDefinition
 * @property {string} name
 * @property {string} type
 * @property {string[]} aliases
 * @property {TextTransformMap | TextTransformDictionary | TextTransformFunction} data
 */

/**
 * @type {TextTransformDefinition[]}
 */
const types = [
	{
		name: "bubble",
		type: "map",
		aliases: [],
		data: BubbleDefinition
	},
	{
		name: "fancy",
		type: "map",
		aliases: [],
		data: FancyDefinition
	},
	{
		name: "upside-down",
		type: "map",
		aliases: ["flipped", "ud", "upsidedown"],
		data: UpsideDownDefinition
	},
	{
		name: "elite",
		type: "map",
		aliases: ["leet", "l33t", "1337"],
		data: LeetDefinition
	},
	{
		name: "medieval",
		type: "map",
		aliases: [],
		data: MedievalDefinition
	},
	{
		name: "runic",
		type: "map",
		aliases: ["runes"],
		data: RunicDefinition
	},
	{
		name: "superscript",
		type: "map",
		aliases: ["small", "smol", "super", "tiny"],
		data: SuperscriptDefinition
	},
	{
		name: "vaporwave",
		type: "map",
		aliases: ["vw", "vapor"],
		data: VaporwaveDefinition
	},
	{
		name: "cockney",
		type: "translate",
		aliases: ["3Head"],
		data: LingoCockneyDefinition
	},
	{
		name: "cowboy",
		type: "translate",
		aliases: ["KKona", "KKonaW"],
		data: LingoCowboyDefinition
	},
	{
		name: "outback",
		type: "translate",
		aliases: ["KKrikey", "australian"],
		data: LingoOutbackDefinition
	},
	{
		name: "capitalize",
		type: "method",
		aliases: ["cap"],
		data: (message) => message
			.split(" ")
			.filter(Boolean)
			.map(i => core.Utils.capitalize(i))
			.join(" ")
	},
	{
		name: "lowercase",
		type: "method",
		aliases: ["lc", "lower"],
		data: (message) => message.toLowerCase()
	},
	{
		name: "uppercase",
		type: "method",
		aliases: ["uc", "upper"],
		data: (message) => message.toUpperCase()
	},
	{
		name: "monkaOMEGA",
		type: "method",
		aliases: [],
		description: "Replaces every \"o\" and \"0\" with the monkaOMEGA emote",
		data: (message) => message.replaceAll(/[oOｏＯоО]/g, " monkaOMEGA ")
	},
	{
		name: "OMEGALUL",
		type: "method",
		aliases: [],
		description: "Replaces every \"o\" and \"0\" with the OMEGALUL emote",
		data: (message) => message.replaceAll(/[oOｏＯоО]/g, " OMEGALUL ")
	},
	{
		name: "owoify",
		type: "method",
		aliases: ["owo", "uwu", "uwuify"],
		data: (message) => message.replaceAll(/[rl]/g, "w")
			.replaceAll(/[RL]/g, "W")
			.replaceAll(/n([aeiou])/g, "ny$1")
			.replaceAll(/N([aeiou])/g, "Ny$1")
			.replaceAll(/N([AEIOU])/g, "Ny$1")
			.replaceAll("ove", "uv")
			.replaceAll(/[!?]+/g, ` ${core.Utils.randArray(["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^"])} `)
	},
	{

		name: "reverse",
		type: "method",
		aliases: [],
		data: (message) => [...message]
			.reverse()
			.join("")
			.replaceAll(/[()]/g, (char) => (char === ")") ? "(" : ")")
	},
	{
		name: "random",
		type: "method",
		aliases: [],
		description: "Picks a random different text transform and applies it",
		data: (message) => {
			const random = core.Utils.randArray(types.filter(i => i.name !== "random"));
			return convert[random.type](message, random.data);
		}
	},
	{
		name: "antiping",
		type: "method",
		aliases: ["unping"],
		description: "Every word will have an invisible character added, so that it does not mention users in e.g. Chatterino.",
		data: (message) => message.split(" ").map(word => {
			if (/^\w+$/.test(word)) {
				return `${word[0]}\u{E0000}${word.slice(1)}`;
			}
			else {
				return word;
			}
		}).join(" "),
		reverseData: (message) => message.split(" ").map(word => word.replaceAll(ANTI_PING_CHARACTER, "")).join(" ")
	},
	{
		name: "trim",
		type: "method",
		aliases: [],
		description: "Removes all whitespace from the message - spaces, tabs, newlines and so on.",
		data: (message) => message.replaceAll(/\s+/g, "")
	},
	{
		name: "explode",
		type: "method",
		aliases: [],
		description: "Opposite of trim - adds a space between every character of the message.",
		data: (message) => [...message]
			.join(" ")
			.replaceAll(/\s+/g, " ")
	},
	{
		name: "binary",
		type: "method",
		aliases: ["bin"],
		data: (message) => [...message].map(i => ("0".repeat(8) + i.codePointAt(0).toString(2)).slice(-8)).join(" "),
		reverseData: (message) => {
			const list = [...message];
			let word = "";
			const result = [];

			for (const char of list) {
				if (char !== "0" && char !== "1" && !/\s/.test(char)) {
					return {
						success: false,
						reply: `Cannot translate from binary - invalid character encountered!`
					};
				}

				if (char === "0" || char === "1") {
					word += char;
				}

				if (word.length === 8 || (/\s/.test(char) && word.length !== 0)) {
					result.push(Number.parseInt(word, 2));
					word = "";
				}
			}

			return String.fromCodePoint(...result);
		}
	},
	{
		name: "morse",
		type: "method",
		aliases: [],
		data: (message) => {
			const arr = [];
			for (const character of message.toLowerCase()) {
				if (character === " ") {
					arr.push("/");
				}
				else if (MorseData[character]) {
					arr.push(MorseData[character]);
				}
			}

			return arr.join(" ");
		}
	},
	{
		name: "box",
		type: "method",
		aliases: ["boxes"],
		description: "Attempts to wrap letters in a box-like thing. Might not work with all fonts.",
		data: (message) => {
			const arr = [];
			const combine = String.fromCodePoint(0xFE0F);
			const box = String.fromCodePoint(0x20E3);

			for (const character of message) {
				if (character === " ") {
					arr.push(character);
				}
				else {
					arr.push(character, box, combine);
				}
			}

			return arr.join("");
		}
	},
	{
		name: "spongebob",
		type: "method",
		aliases: ["mock", "mocking", "spongemock"],
		description: "Randomly capitalizes and lowercases characters in the message to make it look as if mocking someone.",
		data: (message) => [...message].map(char => {
			if (/[a-zA-Z]/.test(char)) {
				return randomInt(0, 1) ? char.toUpperCase() : char.toLowerCase();
			}
			else {
				return char;
			}
		}).join("")
	},
	{
		name: "typoglycemia",
		type: "method",
		aliases: ["tg", "jumble"],
		description: "Shuffles a message to make it typoglycemic. This means that every word with 4+ characters will have all of its letters shuffled, except the first and last one.",
		data: (message) => {
			const result = [];
			for (const word of message.split(/\s/)) {
				if (word.length <= 3) {
					result.push(word);
					continue;
				}

				const stripped = core.Utils.removeAccents(word);
				if (/[^a-z]/i.test(stripped)) {
					result.push(word);
					continue;
				}

				const prefixThreshold = Math.ceil(word.length / 5);
				const suffixThreshold = -Math.max(prefixThreshold - 1, 1);

				const scrambled = [];
				const slicedWord = word.slice(prefixThreshold, suffixThreshold);
				const chars = [...slicedWord];

				while (chars.length > 0) {
					const randomIndex = randomInt(0, chars.length - 1);
					scrambled.push(chars[randomIndex]);
					chars.splice(randomIndex, 1);
				}

				const prefix = word.slice(0, prefixThreshold);
				const center = scrambled.join("");
				const suffix = word.slice(suffixThreshold);

				result.push(`${prefix}${center}${suffix}`);
			}

			return result.join(" ");
		}
	},
	{
		name: "official",
		type: "method",
		aliases: [],
		description: "Replaces your text with \"mathematical\" symbols - also used in attempts to recreate the Twitter \"official sources say\" message.",
		data: (string) => {
			const result = convert.map(string, officialCharactersMap);
			return `ⓘ ${result}`;
		},
		reverseData: (string) => {
			const output = string.replaceAll("ⓘ", "");
			return convert.unmap(output, officialCharactersMap);
		}
	},
	{
		name: "base64",
		type: "method",
		aliases: ["b64"],
		description: "Transforms your input into Base-64 encoding.",
		data: (string) => Buffer.from(string, "utf8").toString("base64"),
		reverseData: (string) => Buffer.from(string, "base64").toString("utf8")
	},
	{
		name: "ascii",
		type: "method",
		aliases: [],
		description: "Transforms your input into ASCII number representation.",
		data: (string) => new TextEncoder().encode(string).join(" "),
		reverseData: (string) => new TextDecoder().decode(new Uint8Array(string.split(/\s+/).map(Number)))
	},
	{
		name: "hex",
		type: "method",
		aliases: ["hexadecimal"],
		description: "Transforms your input into a string of hexadecimal identifiers, based on their ASCII representation. The characters should be two-byte, separated or not.",
		data: (string) => {
			const encodedString = new TextEncoder().encode(string);
			return [...encodedString].map(i => i.toString(16)).join("");
		},
		reverseData: (string) => {
			const regexMatch = string.matchAll(/([a-f0-9]{2})(\W)?/gi);
			const hexArray = [...regexMatch].map(i => Number.parseInt(i[1], 16));

			return new TextDecoder().decode(new Uint8Array(hexArray));
		}
	},
	{
		name: "forsen",
		type: "method",
		aliases: ["forsencode"],
		description: "Transforms your input into a list of \"forsen\" words, based on GaZaTu's ForsenCode protocol.",
		data: (string) => textCaseCode.encode(string, "forsen").join(" ").trim(),
		reverseData: (string) => textCaseCode.decode(string, "forsen").join("").trim()
	},
	{
		name: "spurdo",
		type: "method",
		aliases: ["fug", "Spurdo"],
		description: "\"Spurdo-ifies\" your input.",
		data: (string) => string.toLowerCase()
			.replaceAll("cca", "gga")
			.replaceAll("cci", "gci")
			.replaceAll("ck", "gg")
			.replaceAll("th", "d")
			.replaceAll("t", "d")
			// replace remaining C- groups, but not those we already replaced (have a preceding "G" char)
			.replaceAll(/(?<![g])c(?![he])/g, "g")
			.replaceAll("k", "g")
			.replaceAll("p", "b")
			.replaceAll(/[,.?!](\s+|$)/g, " :DD ")
	}
];

export default {
	convert,
	types
};
