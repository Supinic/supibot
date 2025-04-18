const url = "https://www.instagram.com/static/bundles/es6/ConsumerLibCommons.js/faada8fcb55f.js";
const keyRegex = /\.instagramWebDesktopFBAppId='(\d+)'/;
const cacheKey = "instagram-web-desktop-fb-app-id";

/**
 * @returns {string|null}
 */
export const getFacebookAppID = async () => {
	let key = await core.Cache.getByPrefix(cacheKey);
	if (!key) {
		const response = await core.Got.get("FakeAgent")({
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
		await core.Cache.setByPrefix(cacheKey, key, {
			expiry: 36e5 // 1 hour
		});
	}

	return key;
};

export const resetFacebookAppID = async () => {
	await core.Cache.setByPrefix(cacheKey, null);
};
