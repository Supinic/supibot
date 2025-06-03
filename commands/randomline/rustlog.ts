import { SupiDate, SupiError } from "supi-core";
import config from "../../config.json" with { type: "json" };

type InstancesDefinition = Record<string, {
	url: string;
	default?: boolean;
}>;

const { instances } = config.rustlog as { instances: InstancesDefinition; };

const instancesCacheKey = "rustlog-supported-channels";
const instanceNames = Object.keys(instances);

let defaultInstance: string | undefined;
for (const [name, def] of Object.entries(instances)) {
	if (def.default) {
		defaultInstance = name;
	}
}

if (!defaultInstance) {
	throw new SupiError({
	    message: "Assert error: No default Rustlog instance set"
	});
}

type InstanceChannelMap = Record<string, string[]>;
type ChannelListResponse = {
	channels: { name: string; userID: string; }[];
};
type RandomLineResponse = {
	messages: {
		text: string;
		displayName: string;
		timestamp: string;
		username: string;
	}[];
};

const channelInstanceMap: Map<string, string> = new Map();
const getChannelLoggingInstances = async function () {
	const data = await core.Cache.getByPrefix(instancesCacheKey) as InstanceChannelMap | undefined;
	if (data && Object.keys(data).length !== 0) {
		return data;
	}

	const result: InstanceChannelMap = {};
	const promises = Object.entries(instances).map(async ([instanceKey, instance]) => {
		const response = await core.Got.get("GenericAPI")<ChannelListResponse>({
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
		result[instanceKey] = channels.map(i => i.userID);
	});

	await Promise.allSettled(promises);

	await core.Cache.setByPrefix(instancesCacheKey, result, {
		expiry: 3_600_000 // 1 hour
	});

	return result;
};

const getInstance = async function (channelId: string): Promise<string | null> {
	const instance = channelInstanceMap.get(channelId);
	if (instance) {
		return instance;
	}

	const instanceMap = await getChannelLoggingInstances();
	if (instanceMap[defaultInstance].includes(channelId)) {
		channelInstanceMap.set(channelId, defaultInstance);
		return defaultInstance;
	}

	for (const name of instanceNames) {
		if (instanceMap[name].includes(channelId)) {
			channelInstanceMap.set(channelId, name);
			return name;
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
	const response = await core.Got.get("GenericAPI")<RandomLineResponse>({
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

	const message = response.body.messages.at(0);
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
	const response = await core.Got.get("GenericAPI")<RandomLineResponse>({
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

	const [message] = response.body.messages;
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
