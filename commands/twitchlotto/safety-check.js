const { formatScore, scoreThreshold } = require("./definitions.js");

module.exports = function checkSafetyStatus (safeMode, blacklistedFlags, image) {
	if (image.Score === null) {
		return {
			success: true
		};
	}

	const imageFlags = image.Adult_Flags ?? [];
	const imageNSFWScore = formatScore(image.Score);

	if (safeMode && blacklistedFlags.length === 0) {
		if (imageFlags.length > 0) {
			return {
				success: false,
				reply: `Cannot post image! It contains the following NSFW flags: ${imageFlags.join(", ")}`
			};
		}
		else if (image.Score > scoreThreshold) {
			const thresholdPercent = `${sb.Utils.round(scoreThreshold * 100, 2)}%`;
			return {
				success: false,
				reply: `Cannot post image! Its NSFW score (${imageNSFWScore}) is higher than the threshold (${thresholdPercent}).`
			};
		}
	}

	const illegalFlags = imageFlags.map(i => i.toLowerCase()).filter(i => blacklistedFlags.includes(i));
	if (illegalFlags.length > 0) {
		return {
			success: false,
			reply: `Cannot post image! These flags are blacklisted: ${illegalFlags.join(", ")}`
		};
	}

	return {
		success: true
	};
};
