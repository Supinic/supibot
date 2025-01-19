import symbolData from "./popular-stock-symbols.json";
const findPopularSymbol = (from) => {
	from = from.toLowerCase();

	let bestScore = -Infinity;
	let index = -1;
	for (let i = 0; i < symbolData.length; i++) {
		const currentName = symbolData[i][1];
		if (!currentName.includes(from)) {
			continue;
		}

		const score = sb.Utils.jaroWinklerSimilarity(from, currentName);
		if (score > 0 && score > bestScore) {
			bestScore = score;
			index = i;
		}
	}

	if (bestScore === -Infinity) {
		return null;
	}
	else {
		return symbolData[index][0];
	}
};

export default {
	findPopularSymbol
};
