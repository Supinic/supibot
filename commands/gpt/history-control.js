const ChatGptConfig = require("./config.json");
const createCacheKey = (id) => `gpt-history-user-${id}`;

const reset = async (userData) => {
	const key = createCacheKey(userData.ID);
	await sb.Cache.setByPrefix(key, null);
};

const get = async (userData) => {
	const key = createCacheKey(userData.ID);
	return await sb.Cache.getByPrefix(key);
};

const add = async (userData, promptData) => {
	const history = await get(userData) ?? [];
	const {
		prompt,
		response,
		temperature = ChatGptConfig.defaultTemperature
	} = promptData;

	history.push({
		prompt,
		response,
		temperature,
		time: sb.Date.now()
	});

	const key = createCacheKey(userData.ID);
	await sb.Cache.setByPrefix(key, history, {
		expiry: 7 * 864e5 // 7 days
	});
};

const dump = async (userData) => {
	const { queryNames } = ChatGptConfig;
	const history = await get(userData) ?? [];

	const result = [];
	for (const { prompt, response } of history) {
		result.push(`${queryNames.prompt}: ${prompt}\n${queryNames.response}: ${response}`);
	}

	return result;
};

module.exports = {
	add,
	dump,
	get,
	reset
};
