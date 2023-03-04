const createCacheKey = (id) => `gpt-history-user-${id}`;

const reset = async (userData) => {
	const key = createCacheKey(userData.ID);
	await sb.Cache.setByPrefix(key, null);
};

const get = async (userData) => {
	const key = createCacheKey(userData.ID);
	const history = await sb.Cache.getByPrefix(key);

	return history ?? [];
};

const add = async (userData, userMessage, assistantMessage) => {
	const history = await get(userData) ?? [];
	history.push(
		{ role: "user", content: userMessage },
		{ role: "assistant", content: assistantMessage }
	);

	const key = createCacheKey(userData.ID);
	await sb.Cache.setByPrefix(key, history, {
		expiry: 600_000 // 10 minutes
	});
};

const dump = async (userData) => {
	const history = await get(userData);
	if (history.length === 0) {
		return {
			success: false,
			reply: `You have no ChatGPT history at the moment.`
		};
	}

	let text = "";
	for (let i = 0; i < history.length; i += 2) {
		text += `You: ${history[i].content}\nGPT: ${history[i + 1].content}\n\n`;
	}

	const response = await sb.Got("GenericAPI", {
		method: "POST",
		url: `https://haste.zneix.eu/documents`,
		throwHttpErrors: false,
		body: text
	});

	if (!response.ok) {
		return {
			success: false,
			reply: `Could not export the ChatGPT history! Please try again later.`
		};
	}
	else {
		return {
			success: true,
			reply: `Your ChatGPT history: https://haste.zneix.eu/raw/${response.body.key}`
		};
	}
};

module.exports = {
	add,
	get,
	reset,
	dump
};
