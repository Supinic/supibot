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

		string = string.trim().replace(/_/g, "");

		if (dictionary.endings && /[).?!]$/.test(string)) {
			string += ` ${sb.Utils.randArray(dictionary.endings)}`;
		}

		return string;
	}
};

const textCaseCode = require("./textCaseCode.js");
const officialCharactersMap = require("./definitions/official-characters.json");

const types = [
	{
		name: "bubble",
		type: "map",
		aliases: [],
		data: require("./definitions/bubble.json")
	},
	{
		name: "fancy",
		type: "map",
		aliases: [],
		data: require("./definitions/fancy.json")
	},
	{
		name: "upside-down",
		type: "map",
		aliases: ["flipped", "ud", "upsidedown"],
		data: require("./definitions/upside-down.json")
	},
	{
		name: "elite",
		type: "map",
		aliases: ["leet", "l33t", "1337"],
		data: require("./definitions/leet.json")
	},
	{
		name: "medieval",
		type: "map",
		aliases: [],
		data: require("./definitions/medieval.json")
	},
	{
		name: "runic",
		type: "map",
		aliases: ["runes"],
		data: require("./definitions/runic.json")
	},
	{
		name: "superscript",
		type: "map",
		aliases: ["smol", "super"],
		data: require("./definitions/superscript.json")
	},
	{
		name: "vaporwave",
		type: "map",
		aliases: ["vw", "vapor"],
		data: require("./definitions/vaporwave.json")
	},
	{
		name: "cockney",
		type: "translate",
		aliases: ["3Head"],
		data: require("./lingo-translations/cockney.json")
	},
	{
		name: "cowboy",
		type: "translate",
		aliases: ["KKona", "KKonaW"],
		data: require("./lingo-translations/cowboy.json")
	},
	{
		name: "outback",
		type: "translate",
		aliases: ["KKrikey", "australian"],
		data: require("./lingo-translations/outback.json")
	},
	{
		name: "capitalize",
		type: "method",
		aliases: ["cap"],
		data: (message) => message
			.split(" ")
			.filter(Boolean)
			.map(i => sb.Utils.capitalize(i))
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
		data: (message) => message.replace(/[oOｏＯоО]/g, " monkaOMEGA ")
	},
	{
		name: "OMEGALUL",
		type: "method",
		aliases: [],
		description: "Replaces every \"o\" and \"0\" with the OMEGALUL emote",
		data: (message) => message.replace(/[oOｏＯоО]/g, " OMEGALUL ")
	},
	{
		name: "owoify",
		type: "method",
		aliases: ["owo"],
		data: (message) => message.replace(/[rl]/g, "w")
			.replace(/[RL]/g, "W")
			.replace(/n([aeiou])/g, "ny$1")
			.replace(/N([aeiou])/g, "Ny$1")
			.replace(/N([AEIOU])/g, "Ny$1")
			.replace(/ove/g, "uv")
			.replace(/[!?]+/g, ` ${sb.Utils.randArray(["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^"])} `)
	},
	{

		name: "reverse",
		type: "method",
		aliases: [],
		data: (message) => Array.from(message)
			.reverse()
			.join("")
			.replace(/[()]/g, (char) => (char === ")") ? "(" : ")")
	},
	{
		name: "random",
		type: "method",
		aliases: [],
		description: "Picks a random different text transform and applies it",
		data: (message) => {
			const random = sb.Utils.randArray(types.filter(i => i.name !== "random"));
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
		reverseData: (message) => message.split(" ").map(word => word.replace(/\u{E0000}/gu, "")).join(" ")
	},
	{
		name: "trim",
		type: "method",
		aliases: [],
		description: "Removes all whitespace from the message - spaces, tabs, newlines and so on.",
		data: (message) => message.replace(/\s+/g, "")
	},
	{
		name: "explode",
		type: "method",
		aliases: [],
		description: "Opposite of trim - adds a space between every character of the message.",
		data: (message) => Array.from(message)
			.join(" ")
			.replace(/\s+/g, " ")
	},
	{
		name: "binary",
		type: "method",
		aliases: ["bin"],
		data: (message) => message.split("").map(i => ("0".repeat(8) + i.charCodeAt(0).toString(2)).slice(-8)).join(" "),
		reverseData: (message) => {
			const list = message.split("");
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

			return String.fromCharCode(...result);
		}
	},
	{
		name: "morse",
		type: "method",
		aliases: [],
		data: (message) => {
			const arr = [];
			const morse = require("./definitions/morse.json");
			for (const character of message.toLowerCase()) {
				if (character === " ") {
					arr.push("/");
				}
				else if (morse[character]) {
					arr.push(morse[character]);
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
			const combine = String.fromCharCode(0xFE0F);
			const box = String.fromCharCode(0x20E3);

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
		data: (message) => Array.from(message).map(char => {
			if (/[a-zA-Z]/.test(char)) {
				return sb.Utils.random(0, 1) ? char.toUpperCase() : char.toLowerCase();
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
			for (const word of message.split(/\b/)) {
				const stripped = sb.Utils.removeAccents(word);
				if (/[^a-z]/i.test(stripped)) {
					result.push(word);
					continue;
				}

				const scrambled = [];
				const chars = word.slice(1, -1).split("");
				while (chars.length > 0) {
					const randomIndex = sb.Utils.random(0, chars.length - 1);
					scrambled.push(chars[randomIndex]);
					chars.splice(randomIndex, 1);
				}

				result.push(`${word[0]}${scrambled.join("")}${word[word.length - 1]}`);
			}

			return result.join("");
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
			const output = string.replace(/ⓘ/g, "");
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
		data: (string) => Array.from(new TextEncoder().encode(string)).map(i => i.toString(16)).join(""),
		reverseData: (string) => {
			const regexMatch = string.matchAll(/([a-f0-9]{2})(\W)?/gi);
			const hexArray = Array.from(regexMatch).map(i => parseInt(i[1], 16));

			return new TextDecoder().decode(new Uint8Array(hexArray));
		}
	},
	{
		name: "forsen",
		type: "method",
		aliases: ["forsencode"],
		description: "Transforms your input a list of \"forsen\", based on GaZaTu's ForsenCode protocol.",
		data: (string) => textCaseCode.encode(string, "forsen"),
		reverseData: (string) => textCaseCode.decode(string, "forsen")
	}
];

module.exports = {
	convert,
	types
};
