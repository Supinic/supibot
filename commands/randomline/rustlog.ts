import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";

import { getConfig } from "../../config.js";
const { instances } = getConfig().rustlog;

const instancesCacheKey = "rustlog-supported-channels";
const instanceNames = Object.keys(instances);

let defaultInstanceName: string | undefined;
for (const [name, def] of Object.entries(instances)) {
	if (def.default) {
		defaultInstanceName = name;
	}
}

if (!defaultInstanceName) {
	throw new SupiError({
		message: "Assert error: No default Rustlog instance set"
	});
}

type InstanceChannelMap = Record<string, string[]>;
const channelListSchema = z.object({
	channels: z.array(z.object({
		name: z.string(),
		userID: z.string()
	}))
});
const messageSchema = z.object({
	messages: z.array(z.object({
		text: z.string(),
		displayName: z.string(),
		timestamp: z.iso.datetime(),
		username: z.string()
	})).min(1)
});

const channelInstanceMap: Map<string, string> = new Map();
const getChannelLoggingInstances = async function () {
	const data = await core.Cache.getByPrefix(instancesCacheKey) as InstanceChannelMap | undefined;
	if (data && Object.keys(data).length !== 0) {
		return new Map(Object.entries(data));
	}

	const result: InstanceChannelMap = {};
	const promises = Object.entries(instances).map(async ([instanceKey, instance]) => {
		const response = await core.Got.get("GenericAPI")({
			url: `https://${instance.url}/channels`,
			throwHttpErrors: false,
			timeout: {
				request: 5000
			}
		});

		if (!response.ok) {
			result[instanceKey] = [];
			return;
		}

		const { channels } = channelListSchema.parse(response.body);
		result[instanceKey] = channels.map(i => i.userID);
	});

	await Promise.allSettled(promises);

	await core.Cache.setByPrefix(instancesCacheKey, result, {
		expiry: 3_600_000 // 1 hour
	});

	return new Map(Object.entries(result));
};

const getInstance = async function (channelId: string): Promise<string | null> {
	const instance = channelInstanceMap.get(channelId);
	if (instance) {
		return instance;
	}

	const instanceMap = await getChannelLoggingInstances();
	const defaultInstanceIdList = instanceMap.get(defaultInstanceName);
	if (!defaultInstanceIdList) {
		throw new SupiError({
		    message: "Assert error: no default instance exists"
		});
	}

	if (defaultInstanceIdList.includes(channelId)) {
		channelInstanceMap.set(channelId, defaultInstanceName);
		return defaultInstanceName;
	}

	for (const instanceName of instanceNames) {
		const supportedChannelIds = instanceMap.get(instanceName);
		if (!supportedChannelIds) {
			continue;
		}

		if (supportedChannelIds.includes(channelId)) {
			channelInstanceMap.set(channelId, instanceName);
			return instanceName;
		}
	}

	return null;
};

export const isSupported = async function (channelId: string): Promise<boolean> {
	const instance = await getInstance(channelId);
	return (instance !== null);
};

type RandomLineData =
	| { success: false; reason: string; }
	| {
		success: true;
		date: SupiDate;
		text: string;
		username: string;
	};

export const getRandomChannelLine = async function (channelId: string): Promise<RandomLineData> {
	const instanceName = await getInstance(channelId);
	if (!instanceName) {
		throw new SupiError({
			message: "Assert error: No instance name found for existing channel",
			args: { channelId }
		});
	}

	const instance = instances[instanceName];
	const response = await core.Got.get("GenericAPI")({
		url: `https://${instance.url}/channelid/${channelId}/random`,
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

	const message = messageSchema.parse(response.body).messages.at(0);
	if (!message) {
		return {
			success: false,
			reason: `Couldn't fetch a random line! Try again in a little bit.`
		};
	}

	return {
		success: true,
		date: new SupiDate(message.timestamp),
		text: message.text,
		username: message.username
	};
};

export const getRandomUserLine = async function (channelId: string, userId: string): Promise<RandomLineData> {
	const instanceName = await getInstance(channelId);
	if (!instanceName) {
		throw new SupiError({
			message: "Assert error: No instance name found for existing channel",
			args: { channelId }
		});
	}

	const instance = instances[instanceName];
	const response = await core.Got.get("GenericAPI")({
		url: `https://${instance.url}/channelid/${channelId}/userid/${userId}/random`,
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

	const [message] = messageSchema.parse(response.body).messages;
	return {
		success: true,
		date: new SupiDate(message.timestamp),
		text: message.text,
		username: message.username
	};
};

type ChannelAdditionResponse =
	| { success: false; reason: string; }
	| { success: false; code: number; }
	| { success: true; };

export const addChannel = async function (channelId: string): Promise<ChannelAdditionResponse> {
	if (!process.env.API_RUSTLOG_ADMIN_KEY) {
		return {
			success: false,
			reason: "no-key"
		};
	}

	const response = await core.Got.get("GenericAPI")({
		url: "https://logs.ivr.fi/admin/channels",
		method: "POST",
		throwHttpErrors: false,
		headers: {
			"X-API-Key": process.env.API_RUSTLOG_ADMIN_KEY
		},
		json: {
			channels: [channelId]
		}
	});

	if (!response.ok) {
		return {
			success: false,
			code: response.statusCode
		};
	}
	else {
		// Purge all Rustlog instances cache after a new channel is added to IVR Rustlog
		await core.Cache.setByPrefix(instancesCacheKey, null);

		return {
			success: true
		};
	}
};
