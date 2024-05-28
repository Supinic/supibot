const instancesCacheKey = "rustlog-supported-channels";

let config;
try {
	config = require("../../config.json");
}
catch {
	config = require("../../config-default.json");
}

const { instances } = config.rustlog;

const getChannelLoggingInstances = async function () {
	const data = await sb.Cache.getByPrefix(instancesCacheKey);
	if (data) {
		return data;
	}

	const result = {};
	const promises = Object.entries(instances).map(async ([instanceKey, instance]) => {
		const response = await sb.Got("GenericAPI", {
			url: `https://${instance.url}/channels`,
			throwHttpErrors: false,
			timeout: {
				request: 5000
			}
		});

		if (!response.ok) {
			return;
		}

		const { channels } = response.body;
		for (const channel of channels) {
			if (instance.default === true) {
				result[channel.userID] = instanceKey;
			}
			else {
				result[channel.userID] ??= instanceKey;
			}
		}
	});

	await Promise.allSettled(promises);

	await sb.Cache.setByPrefix(instancesCacheKey, result, {
		expiry: 3_600_000 // 1 hour
	});

	return result;
};

const getSupportedChannelList = async function () {
	const data = await getChannelLoggingInstances();
	return Object.keys(data);
};

const getInstance = async function (channelID) {
	const instanceMap = await getChannelLoggingInstances();
	const key = instanceMap[channelID];

	const instance = instances[key];
	if (!instance) {
		throw new sb.Error({
			message: "Incorrect Rustlog instance definition",
			args: { instanceMap, key, instance }
		});
	}

	return instance;
};

const isSupported = async function (channelID) {
	const list = await getSupportedChannelList();
	if (list === null) {
		return null;
	}

	return list.includes(channelID);
};

const getRandomChannelLine = async function (channelID) {
	const instance = await getInstance(channelID);
	const response = await sb.Got("GenericAPI", {
		url: `https://${instance.url}/channelid/${channelID}/random`,
		throwHttpErrors: false,
		searchParams: {
			json: "1"
		}
	});

	if (response.statusCode === 403) {
		return {
			success: false,
			reason: "This channel has opted out of having their messages logged via the Rustlog third party service!"
		};
	}
	else if (response.statusCode === 404) {
		return {
			success: false,
			reason: "Could not load logs for that channel!"
		};
	}
	else if (response.statusCode !== 200) {
		return {
			success: false,
			reason: `The channel logs are not available at the moment (status code ${response.statusCode})! Try again later.`
		};
	}

	const [message] = response.body.messages;
	if (!message) {
		return {
			success: false,
			reply: `Couldn't fetch a random line! Try again in a little bit.`
		};
	}

	return {
		success: true,
		date: new sb.Date(message.timestamp),
		text: message.text,
		username: message.username
	};
};

const getRandomUserLine = async function (channelID, userID) {
	const instance = await getInstance(channelID);
	const response = await sb.Got("GenericAPI", {
		url: `https://${instance.url}/channelid/${channelID}/userid/${userID}/random`,
		throwHttpErrors: false,
		searchParams: {
			json: "1"
		}
	});

	if (response.statusCode === 403) {
		return {
			success: false,
			reason: "This user has opted out of having their messages logged via the Rustlog third party service!"
		};
	}
	else if (response.statusCode === 404) {
		return {
			success: false,
			reason: "Could not load logs for that user!"
		};
	}
	else if (response.statusCode !== 200) {
		return {
			success: false,
			reason: `The channel logs are not available at the moment (status code ${response.statusCode})! Try again later.`
		};
	}

	const [message] = response.body.messages;
	return {
		success: true,
		date: new sb.Date(message.timestamp),
		text: message.text,
		username: message.username
	};
};

const addChannel = async function (channelID) {
	if (!sb.Config.has("RUSTLOG_ADMIN_KEY")) {
		return {
			success: false,
			reason: "no-key"
		};
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://logs.ivr.fi/admin/channels",
		method: "POST",
		throwHttpErrors: false,
		headers: {
			"X-API-Key": sb.Config.get("RUSTLOG_ADMIN_KEY")
		},
		json: {
			channels: [channelID]
		}
	});

	if (!response.ok) {
		return {
			success: false,
			code: response.statusCode
		};
	}
	else {
		// Purge all rustlog instances cache after a new channel is added to IVR Rustlog
		await sb.Cache.setByPrefix(instancesCacheKey, null);

		return {
			success: true
		};
	}
};

module.exports = {
	addChannel,
	isSupported,
	getRandomChannelLine,
	getRandomUserLine
};
