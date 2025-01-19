import GptNexra from "../gpt/gpt-nexra.js";
import GptModeration from "../gpt/moderation.js";

const RAW_TEXT_REGEX = /^\[(?<date>[\d-\s:]+)]\s+#\w+\s+(?<username>\w+):\s+(?<message>.+?)$/;

const addQueryContext = (query, context, channelName) => query.replace("%CHANNEL_NAME%", channelName);
const RUSTLOG_RESPONSES = {
	403: "That channel has opted out from being logged!",
	404: "That channel is not being logged at the moment!",
	default: "Unspecified error occured! Try again later."
};

const getLocalLogs = async (channel, limit = 50) => {
	const twitch = sb.Platform.get("twitch");
	const channelData = sb.Channel.get(channel, twitch);

	const tableName = channelData.getDatabaseName();
	const data = await sb.Query.getRecordset(rs => rs
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
		.reverse()
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

const getRustlogLogs = async (channel, limit = 50) => {
	const twitch = sb.Platform.get("twitch");
	const channelId = await twitch.getUserID(channel);
	if (!channelId) {
		return {
			success: false,
			reply: "The channel name you provided does not exist!"
		};
	}

	const { year, month, day } = new sb.Date(sb.Date.getTodayUTC());
	let logsResponse = await sb.Got.get("GenericAPI")({
		url: `https://logs.ivr.fi/channelid/${channelId}/${year}/${month}/${day}`,
		throwHttpErrors: false,
		responseType: "text",
		searchParams: {
			reverse: "1",
			limit: String(limit)
		}
	});

	if (!logsResponse.ok) {
		logsResponse = await sb.Got.get("GenericAPI")({
			url: `https://logs.zonian.dev/channelid/${channelId}/${year}/${month}/${day}`,
			throwHttpErrors: false,
			responseType: "text",
			searchParams: {
				reverse: "1",
				limit: String(limit)
			}
		});

		if (!logsResponse.ok) {
			return {
				success: false,
				reply: RUSTLOG_RESPONSES[logsResponse.statusCode] ?? RUSTLOG_RESPONSES.default
			};
		}
	}

	const text = logsResponse.body
		.split(/\r?\n/)
		.map(i => i.match(RAW_TEXT_REGEX)?.groups)
		.filter(Boolean)
		.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
		.map(i => `${i.username}: ${i.message}`)
		.join("\n");

	return {
		success: true,
		text
	};
};

export default {
	Name: "chatsummary",
	Aliases: ["csum"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Summarizes the last couple of messages in the current (or provided) channel via GPT. This command applies a 30s cooldown to all users in the channel it is used in.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "type", type: "string" }
	],
	Whitelist_Response: null,
	initialize: function () {
		const BASE_QUERY = sb.Utils.tag.trim `
			Reply only in English.
			Concisely summarize the following messages from an online chatroom %CHANNEL_NAME%
			(ignore chat bots replying to users' commands, and assume unfamiliar words to be emotes)
		`;

		this.data.queries = {
			base: `${BASE_QUERY}`,
			topical: `${BASE_QUERY} into a numbered list of discussion topics (maximum of 5)`,
			single: `${BASE_QUERY} into a description of a single, most important topic being discussed - do not include any additional topics`,
			user: `${BASE_QUERY} into a bullet point list of username-specific topics (maximum of 5, sort by importance)`
		};
	},
	Code: async function chatSummary (context, channelInput) {
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
		const query = this.data.queries[queryType];
		if (!query) {
			return {
				success: false,
				reply: `Invalid query type provided! Use one of: ${Object.keys(this.data.queries).join(", ")}`
			};
		}

		const contextQuery = addQueryContext(query, context, channel);
		const nexraExecution = await GptNexra.execute(context, `${contextQuery}\n\n${logsResult.text}`, {
			url: "gpt-4-32k"
		});

		const { response } = nexraExecution;
		if (!response && nexraExecution.reply) {
			return nexraExecution;
		}

		// API errors can come as 200 OK with error status code in body
		if (!response.ok || response.body.status === false) {
			return {
				success: false,
				reply: GptNexra.getRequestErrorMessage()
			};
		}

		const message = GptNexra.extractMessage(response);
		const modCheck = await GptModeration.check(context, message);
		if (!modCheck.success) {
			return modCheck;
		}

		return {
			reply: `${message}`,
			cooldown: {
				length: 30_000,
				command: this.Name,
				user: null,
				channel: context.channel?.ID
			}
		};
	},
	Dynamic_Description: async () => ([
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
		sb.Utils.tag.trim `
			<li>
				<ul><code>base</code> baseline summary (this one is used by default if no type is provided)</ul>
				<ul><code>single</code> focuses on a single most important topic</ul>
				<ul><code>topical</code> creates a list of up to 5 topic summaries</ul>
				<ul><code>user</code> creates a list of up to 5 summaries per user</ul>
			</li>
		`
	])
};
