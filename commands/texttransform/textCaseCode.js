const DIAERESIS = "\u{0308}";

const encode = (input, codeWord) => {
	if (!codeWord) {
		throw new Error("Code word not provided");
	}
	else if (codeWord.length < 6) {
		throw new Error("Code word not long enough, at least 6 characters are required");
	}

	const output = [];
	const max = Math.max(127, (1 << codeWord.length) - 1);

	for (let i = 0; i < input.length; i++) {
		const value = input.charCodeAt(i);
		if (value > max || input[i].test(/\s/)) {
			output.push(input[i]);
			continue;
		}

		let bit = (1 << codeWord.length);
		const result = [];

		for (const codeChar of codeWord) {
			if (codeWord.length === 6 && bit === 32) {
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

const decode = (input, codeWord) => {
	if (!codeWord) {
		throw new Error("Code word not provided");
	}
	else if (codeWord.length < 6) {
		throw new Error("Code word not long enough, at least 6 characters are required");
	}

	const words = input.split(/\s/);
	const output = [];

	for (const rawWord of words) {
		let appendix = "";
		const normalized = rawWord.normalize("NFKD").replaceAll(DIAERESIS, "").toLowerCase();
		const codeIndex = normalized.indexOf(codeWord.toLowerCase());
		if (codeIndex === -1) {
			output.push(rawWord);
			continue;
		}

		let word = rawWord;
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
			if (codeWord.length === 6 && bit === 32) {
				const hasDiaeresis = (word[i].normalize("NFKD").split("")[1] === DIAERESIS);
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

		output.push(String.fromCharCode(value));
		if (appendix) {
			output.push(appendix, " ");
		}
	}

	return output;
};

module.exports = {
	encode,
	decode
};
