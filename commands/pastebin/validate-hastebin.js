const validate = async function (server) {
	const slug = sb.Utils.randomString(64);
	const postResponse = await sb.Got("GenericAPI", {
		method: "POST",
		url: `https://${server}/documents`,
		throwHttpErrors: false,
		body: slug
	});

	if (postResponse.statusCode % 100 === 5) {
		return null;
	}
	else if (postResponse.statusCode !== 200) {
		return false;
	}

	const { key } = postResponse.body;
	if (typeof key !== "string") {
		return false;
	}

	const getResponse = await sb.Got("GenericAPI", {
		url: `https://${server}/raw/${key}`,
		throwHttpErrors: false,
		responseType: "text"
	});

	if (getResponse.statusCode % 100 === 5) {
		return null;
	}
	else if (getResponse.statusCode !== 200) {
		return false;
	}

	return (getResponse.body === slug);
};

module.exports = async function validateHastebinServer (command, server) {
	const cacheKey = `valid-hastebin-${server}`;
	let isValid = await command.getCacheData(cacheKey);
	if (typeof isValid === "boolean") {
		return isValid;
	}

	try {
		isValid = await validate(server);
	}
	catch {
		isValid = null;
	}

	if (typeof isValid === "boolean") {
		await command.setCacheData(cacheKey, isValid, {
			expiry: 7 * 864e5 // 7 days
		});

		return isValid;
	}
	else { // do not cache when `isValid === null` - this means the server is inaccessible
		return false;
	}
};
