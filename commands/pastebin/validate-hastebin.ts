import * as z from "zod";
import type { Command } from "../../classes/command.js";

const validateSchema = z.object({ key: z.string() });

const validate = async function (server: string) {
	const slug = core.Utils.randomString(64);
	const postResponse = await core.Got.get("GenericAPI")({
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

	const validation = validateSchema.safeParse(postResponse.body);
	if (!validation.success) {
		return false;
	}

	const { key } = validation.data;
	const getResponse = await core.Got.get("GenericAPI")({
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

export default async function validateHastebinServer (command: Command, server: string) {
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
	}

	return isValid;
};
