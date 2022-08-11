const supportedChannelsCacheKey = "justlog-supported-channels";

const getSupportedChannelList = async function () {
	let data = await sb.Cache.getByPrefix(supportedChannelsCacheKey);
	if (data) {
		return data;
	}

	const response = await sb.Got("GenericAPI", {
		url: "https://logs.ivr.fi/channels"
	});

	data = response.body.channels;
	await sb.Cache.setByPrefix(supportedChannelsCacheKey, data, {
		expiry: 864e5 // 1 day
	});

	return data;
};

const isSupported = async function (channelID) {
	const list = await getSupportedChannelList();
	return list.some(i => i.userID === channelID);
};

const getRandomChannelLine = async function (channelID) {
	const response = await sb.Got("GenericAPI", {
		url: `https://logs.ivr.fi/channelid/${channelID}/random`,
		throwHttpErrors: false,
		searchParams: {
			json: "1"
		}
	});

	if (response.statusCode === 403) {
		return {
			success: false,
			reason: "That channel has opted out of logging their messages!"
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
	return {
		success: true,
		date: new sb.Date(message.timestamp),
		text: message.text,
		username: message.username
	};
};

const getRandomUserLine = async function (channelID, userID) {
	const response = await sb.Got("GenericAPI", {
		url: `https://logs.ivr.fi/channelid/${channelID}/userid/${userID}/random`,
		throwHttpErrors: false,
		searchParams: {
			json: "1"
		}
	});

	if (response.statusCode === 403) {
		return {
			success: false,
			reason: "That user has opted out of logging their messages!"
		};
	}
	else if (response.statusCode === 404) {
		return {
			success: false,
			reason: "Could not load logs for that user!"
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

module.exports = {
	isSupported,
	getRandomChannelLine,
	getRandomUserLine
};
