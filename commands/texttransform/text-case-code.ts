/* eslint-disable no-bitwise */
import { SupiError } from "supi-core";
import type { ResultFailure } from "../../classes/command.ts";

const DIAERESIS = "\u{0308}";

const encode = (input: string, codeWord: string): string[] | ResultFailure => {
	if (!codeWord) {
		throw new Error("Code word not provided");
	}
	else if (codeWord.length < 6) {
		return {
			success: false,
			reply: "Your code word not long enough! At least 6 characters are required."
		};
	}

	let buffer = "";
	const output = [];
	const max = Math.max(127, (1 << codeWord.length) - 1);

	for (let i = 0; i < input.length; i++) {
		const value = input.codePointAt(i);
		if (typeof value !== "number") {
			throw new SupiError({
				message: "Assert error: No code point available"
			});
		}
		else if (value > max) {
			buffer += input[i];
			continue;
		}

		if (buffer.length !== 0) {
			output.push(buffer);
			buffer = "";
		}

		let bit = (1 << codeWord.length);
		const result = [];
		for (const codeChar of codeWord) {
			if (bit === 32) {
				let diaeresis = "";
				if ((value & bit) === 0) {
					diaeresis = DIAERESIS;
				}

				bit >>= 1;
				result.push((value & bit) ? codeChar.toLowerCase() : codeChar.toUpperCase());
				bit >>= 1;
				result.push(diaeresis);
			}
			else {
				result.push((value & bit) ? codeChar.toUpperCase() : codeChar.toLowerCase());
				bit >>= 1;
			}
		}

		output.push(result.join(""));
	}

	return output;
};

const decode = (input: string, codeWord: string): string[] | ResultFailure => {
	if (!codeWord) {
		throw new SupiError({ message: "Code word not provided" });
	}
	else if (codeWord.length < 6) {
		return {
			success: false,
			reply: "Your code word not long enough! At least 6 characters are required."
		};
	}

	const words = input.split(/\s/);
	const output = [];
	for (const rawWord of words) {
		const normalized = rawWord.replaceAll(DIAERESIS, "").toLowerCase();
		const codeIndex = normalized.indexOf(codeWord.toLowerCase());
		if (codeIndex === -1) {
			continue;
		}

		let word = rawWord;
		let appendix = "";
		if (normalized.length !== codeWord.length) {
			word = rawWord.slice(codeIndex, codeIndex + codeWord.length);
			if (codeIndex > 0) {
				output.push(rawWord.slice(0, codeIndex));
			}

			appendix = rawWord.slice(codeIndex + codeWord.length);
		}

		let bit = (1 << codeWord.length);
		let value = 0;

		for (let i = 0; i < word.length; i++) {
			const isUpperCase = (word[i] === word[i].toUpperCase());
			if (bit === 32) {
				const normalizedStringArray = word[i].split("");
				const hasDiaeresis = (normalizedStringArray[1] === DIAERESIS);
				if (!hasDiaeresis) {
					value += bit;
				}

				bit >>= 1;

				if (!isUpperCase) {
					value += bit;
				}

				bit >>= 1;
			}
			else {
				value += (isUpperCase) ? (bit) : 0;
				bit >>= 1;
			}
		}

		output.push(String.fromCodePoint(value));
		if (appendix) {
			output.push(appendix, " ");
		}
	}

	if (output.length === 0) {
		return {
			success: false,
			reply: "Invalid input provided, couldn't decode anything!"
		};
	}

	return output;
};

export default { encode, decode };
