import { declare } from "../../classes/command.js";
import { SupiDate, SupiError } from "supi-core";

import { GptDeepInfra } from "../gpt/gpt-deepinfra.js";
import gptConfig from "../gpt/config.json" with { type: "json" };

import { check as checkModeration } from "../gpt/moderation.js";
import { GptContext, ModelData } from "../gpt/index.js";

const { models } = gptConfig;
const summaryModel = models.maverick as ModelData;
const DEFAULT_LOG_AMOUNT = 50;

const RAW_TEXT_REGEX = /^\[(?<date>[\d-\s:]+)]\s+#\w+\s+(?<username>\w+):\s+(?<message>.+?)$/;

const addQueryContext = (query: string, channelName: string) => query.replace("%CHANNEL_NAME%", channelName);
const RUSTLOG_RESPONSES = {
	403: "That channel has opted out from being logged!",
	404: "That channel is not being logged at the moment!",
	default: "Unspecified error occured! Try again later."
};

const getLocalLogs = async (channel: string, limit: number = DEFAULT_LOG_AMOUNT) => {
	const twitch = sb.Platform.getAsserted("twitch");
	const channelData = sb.Channel.get(channel, twitch);
	if (!channelData) {
		throw new SupiError({
		    message: "Assert error: Local channel does not exist",
			args: { channel }
		});
	}

	const tableName = channelData.getDatabaseName();
	const data = await core.Query.getRecordset<{ Platform_ID: string; Text: string; }[]>(rs => rs
		.select("Platform_ID", "Text")
		.from("chat_line", tableName)
		.orderBy("ID DESC")
		.limit(limit)
	);

	const userIds = new Set(data.map(i => i.Platform_ID));
	const promises = [...userIds].map(async i => ({
		id: i,
		name: await twitch.fetchUsernameByUserPlatformID(i)
	}));

	const usersData = await Promise.all(promises);
	const result = data
		.toReversed()
		.map(row => {
			const userData = usersData.find(i => row.Platform_ID === i.id);
			if (userData) {
				return `${userData.name}: ${row.Text}`;
			}
			else {
				return null;
			}
		})
		.filter(Boolean);

	return {
		success: true,
		text: result.join("\n")
	};
};

const getRustlogLogs = async (channel: string, limit: number = DEFAULT_LOG_AMOUNT) => {
	const twitch = sb.Platform.getAsserted("twitch");
	const channelId = await twitch.getUserID(channel);
	if (!channelId) {
		return {
			success: false,
			reply: "The channel name you provided does not exist!"
		};
	}

	const { year, month, day } = new SupiDate(SupiDate.getTodayUTC());
	let logsResponse = await core.Got.get("GenericAPI")({
		url: `https://logs.ivr.fi/channelid/${channelId}/${year}/${month}/${day}`,
		throwHttpErrors: false,
		responseType: "text",
		searchParams: {
			reverse: "1",
			limit: String(limit)
		}
	});

	if (!logsResponse.ok) {
		logsResponse = await core.Got.get("GenericAPI")({
			url: `https://logs.zonian.dev/channelid/${channelId}/${year}/${month}/${day}`,
			throwHttpErrors: false,
			responseType: "text",
			searchParams: {
				reverse: "1",
				limit: String(limit)
			}
		});

		if (!logsResponse.ok) {
			let reply;
			const { statusCode } = logsResponse;
			if (statusCode === 403 || statusCode === 404) {
				reply = RUSTLOG_RESPONSES[statusCode];
			}
			else {
				reply = RUSTLOG_RESPONSES.default;
			}

			return {
				success: false,
				reply
			};
		}
	}

	const mappedText = logsResponse.body
		.split(/\r?\n/)
		.map(i => i.match(RAW_TEXT_REGEX)?.groups)
		.filter(Boolean) as Record<string, string>[];

	const text = mappedText
		.toSorted((a, b) => new SupiDate(a.date).valueOf() - new SupiDate(b.date).valueOf())
		.map(i => `${i.username}: ${i.message}`)
		.join("\n");

	return {
		success: true,
		text
	};
};

const BASE_QUERY = "Briefly summarize the following messages from a chatroom. Ignore chat bots replying to users' commands. Assume unfamiliar words to be emotes";
const queries = {
	base: BASE_QUERY,
	topical: `${BASE_QUERY} into a numbered list of discussion topics (maximum of 5)`,
	single: `${BASE_QUERY} into a description of a single, most important topic being discussed - do not include any additional topics`,
	user: `${BASE_QUERY} into a bullet point list of username-specific topics (maximum of 5, sort by importance)`
} as const;

const isQueryType = (input: string): input is keyof typeof queries => (
	Object.keys(queries).includes(input)
);

export default declare({
	Name: "chatsummary",
	Aliases: ["csum"],
	Cooldown: 5000,
	Description: "Summarizes the last couple of messages in the current (or provided) channel via GPT. This command applies a 30s cooldown to all users in the channel it is used in.",
	Flags: ["mention","pipe"],
	Params: [{ name: "type", type: "string" }] as const,
	Whitelist_Response: null,
	Code: async function chatSummary (context, channelInput) {
		if (!context.channel) {
			return {
			    success: false,
			    reply: "This command is not available in private messages!"
			};
		}

		let channel = channelInput;
		if (!channel) {
			if (context.platform.name !== "twitch") {
				return {
					success: false,
					reply: "Outside of Twitch, you must provide the channel name you want to summarize!"
				};
			}

			channel = context.channel.Name;
		}

		const channelData = sb.Channel.get(channel);
		const logsResult = (channelData && channelData.Logging.has("Lines"))
			? await getLocalLogs(channel)
			: await getRustlogLogs(channel);

		if (!logsResult.success) {
			return logsResult;
		}

		const queryType = context.params.type ?? "base";
		if (!isQueryType(queryType)) {
			return {
				success: false,
				reply: `Invalid query type provided! Use one of: ${Object.keys(queries).join(", ")}`
			};
		}

		const query = queries[queryType];
		const contextQuery = addQueryContext(query, channel);
		const fakeContext = context as unknown as GptContext;

		const nexraExecution = await GptDeepInfra.execute(fakeContext, `${contextQuery}\n\n${logsResult.text}`, summaryModel);
		if (!nexraExecution.success) {
			return nexraExecution;
		}

		const { response } = nexraExecution;
		// API errors can come as 200 OK with error status code in body
		if (!response.ok) {
			return {
				success: false,
				reply: GptDeepInfra.getRequestErrorMessage()
			};
		}

		const message = GptDeepInfra.extractMessage(fakeContext, response);
		const modCheck = await checkModeration(fakeContext, message);
		if (!modCheck.success) {
			return modCheck;
		}

		return {
			reply: message,
			cooldown: {
				length: 30_000,
				command: this.Name,
				user: null,
				channel: context.channel.ID
			}
		};
	},
	Dynamic_Description: () => ([
		"Fetches the last several chat messages in the current or provided channel and summarizes them using GPT.",
		"",

		"<code>$chatsummary</code>",
		"<code>$csum</code>",
		"Summarizes the latest messages in the current channel",
		"",

		"<code>$chatsummary (channel)</code>",
		"<code>$chatsummary forsen</code>",
		"<code>$csum forsen</code>",
		"Summarizes the latest messages in the provided channel",
		`This supports all channels being logged by <a href="https://logs.ivr.fi/">Rustlog</a> - this means even channels that Supibot is not in at the current time.`,
		"It also means not all channels Supibot is in are supported.",
		"",

		"<code>$chatsummary type:(query type)</code>",
		"Summarizes the latest messages, but in a different manner:",
		core.Utils.tag.trim `
			<li>
				<ul><code>base</code> baseline summary (this one is used by default if no type is provided)</ul>
				<ul><code>single</code> focuses on a single most important topic</ul>
				<ul><code>topical</code> creates a list of up to 5 topic summaries</ul>
				<ul><code>user</code> creates a list of up to 5 summaries per user</ul>
			</li>
		`
	])
});
