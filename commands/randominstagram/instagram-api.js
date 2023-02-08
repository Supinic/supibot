const url = "https://www.instagram.com/static/bundles/es6/ConsumerLibCommons.js/faada8fcb55f.js";
const keyRegex = /\.instagramWebDesktopFBAppId='(\d+)'/;
const cacheKey = "instagram-web-desktop-fb-app-id";

/**
 * @returns {string|null}
 */
const getFacebookAppID = async () => {
	let key = await sb.Cache.getByPrefix(cacheKey);
	if (!key) {
		const response = await sb.Got("FakeAgent", {
			url,
			throwHttpErrors: false,
			responseType: "text"
		});

		if (response.statusCode !== 200) {
			return null;
		}

		const match = response.body.match(keyRegex);
		if (!match) {
			return null;
		}

		key = match[1];
		await sb.Cache.setByPrefix(cacheKey, key, {
			expiry: 36e5 // 1 hour
		});
	}

	return key;
};

const resetFacebookAppID = async () => {
	await sb.Cache.setByPrefix(cacheKey, null);
};

module.exports = {
	getFacebookAppID,
	resetFacebookAppID
};
