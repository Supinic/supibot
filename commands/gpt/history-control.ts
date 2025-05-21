import type { User } from "../../classes/user.js";

const createCacheKey = (id: number) => `gpt-history-user-${id}`;

type PromptContentImage = {
	type: "image_url";
	image_url: { url: string; };
};
type PromptContentText = {
	type: "text";
	userMessage: string;
};
type PromptContent = PromptContentText | PromptContentImage;

type PromptHistoryEntry = {
	role: "user" | "system" | "assistant";
	content: string | PromptContent[];
};

export const add = async (userData: User, userMessage: string, assistantMessage: string) => {
	const history = await get(userData);
	history.push(
		{ role: "user", content: userMessage },
		{ role: "assistant", content: assistantMessage }
	);

	const key = createCacheKey(userData.ID);
	await core.Cache.setByPrefix(key, history, {
		expiry: 600_000 // 10 minutes
	});
};

export const get = async (userData: User) => {
	const key = createCacheKey(userData.ID);
	const history = await core.Cache.getByPrefix(key) as PromptHistoryEntry[] | undefined;

	return history ?? [];
};

export const imageAdd = async (userData: User, userMessage: string, imageUrl: string, assistantMessage: string) => {
	const history = await get(userData);
	history.push(
		{
			role: "user",
			content: [
				{ type: "text", userMessage },
				{ type: "image_url", image_url: { url: imageUrl } }
			]
		},
		{ role: "assistant", content: assistantMessage }
	);

	const key = createCacheKey(userData.ID);
	await core.Cache.setByPrefix(key, history, {
		expiry: 600_000 // 10 minutes
	});
};

const formatHistoryEntry = (input: PromptHistoryEntry): string => {
	if (typeof input.content === "string") {
		return input.content;
	}

	const result = [];
	for (const item of input.content) {
		if (item.type === "text") {
			result.push(`Text: ${item.userMessage}`);
		}
		else {
			result.push(`Image: ${item.image_url.url}`);
		}
	}

	return result.join("; ");
};

export const dump = async (userData: User) => {
	const history = await get(userData);
	if (history.length === 0) {
		return {
			success: false,
			reply: `You have no ChatGPT history at the moment.`
		};
	}

	let text = "";
	for (let i = 0; i < history.length; i += 2) {
		const userEntry = formatHistoryEntry(history[i]);
		const gptEntry = formatHistoryEntry(history[i + 1]);

		text += `You: ${userEntry}\nGPT: ${gptEntry}\n\n`;
	}

	const response = await core.Got.get("GenericAPI")<{ key: string }>({
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

export const reset = async (userData: User) => {
	const key = createCacheKey(userData.ID);
	await core.Cache.setByPrefix(key, null);
};

export default {
	add,
	imageAdd,
	get,
	reset,
	dump
};
