import { type GotResponse, SupiError } from "supi-core";
import { checkInputLimits, determineOutputLimit, getHistoryMode, getTemperature, getUserHash, GptTemplate } from "./gpt-template.js";
import GptHistory from "./history-control.js";
import { GptContext, ModelData } from "./index.js";

const DEFAULT_SYSTEM_MESSAGE = "Be extremely concise. Do not add URLs to the response.";

type OpenAiMessage = {
	annotations: unknown[];
	content: string;
	refusal: null;
	role: "assistant";
};
type OpenAiResponse = {
	choices: {
		finish_reason: "stop";
		index: number;
		message: OpenAiMessage;
	}[];
	created: number;
	id: string;
	model: string;
	object: string;
	usage: {
		completion_tokens: number;
		prompt_tokens: number;
		total_tokens: number;
	}
};
type OpenAiPayload = {
	model: string;
	messages: unknown[];
	user: string;
	temperature?: number;
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	max_completion_tokens?: number;
	max_tokens?: number;
	reasoning_effort?: "minimal" | "low" | "medium" | "high";
};

const getHistory = async (context: GptContext, query: string, options: { noSystemRole: boolean }) => {
	const { historyMode } = await getHistoryMode(context);
	const promptHistory = (historyMode === "enabled")
		? await GptHistory.get(context.user)
		: [];

	if (options.noSystemRole) {
		return [
			...promptHistory,
			{ role: "user", content: query }
		];
	}

	if (context.params.image) {
		return [
			...promptHistory,
			{
				role: "user",
				content: [
					{ type: "text", text: `${DEFAULT_SYSTEM_MESSAGE} ${query}` },
					{ type: "image_url", image_url: { url: context.params.image } }
				]
			}
		];
	}
	else {
		const { platform, channel } = context;
		const channelString = (channel)
			? `, in channel ${channel.Description ?? channel.Name}`
			: "";

		const contextSystemMessage = core.Utils.tag.trim `
			You are being queried on behalf of ${platform.selfName},
			a chat bot running on ${platform.name}${channelString}.
			Don't reference the chat bot directly, but rather assume its position,
			and reply in first person when queried via name.
		`;

		return [
			...promptHistory,
			{ role: "user", content: `${DEFAULT_SYSTEM_MESSAGE} ${contextSystemMessage} ${query}` }
		];
	}
};

const gptLinkRegex = /\(?\[.+?]\((.+)[?&]utm_source=openai\)\)?/gi;
const trimMarkdownLinks = (input: string) => input.replaceAll(gptLinkRegex, "$1").trim();
const removeMarkdownLinks = (input: string) => input.replaceAll(gptLinkRegex, "").trim();

export const GptOpenAI = {
	async execute (context: GptContext, query: string, modelData: ModelData) {
		if (!process.env.API_OPENAI_KEY) {
			throw new SupiError({
				message: "No OpenAI key configured (API_OPENAI_KEY)"
			});
		}

		const historyOptions = {
			noSystemRole: Boolean(modelData.noSystemRole)
		};

		let messages = await getHistory(context, query, historyOptions);
		const messagesLength = messages.reduce((acc, cur) => acc + cur.content.length, 0);
		const inputLimitCheck = checkInputLimits(modelData, messagesLength);

		if (!inputLimitCheck.success) {
			await GptHistory.reset(context.user);

			messages = await getHistory(context, query, historyOptions);
			const messagesLength = messages.reduce((acc, cur) => acc + cur.content.length, 0);
			const repeatInputLimitCheck = checkInputLimits(modelData, messagesLength);
			if (!repeatInputLimitCheck.success) {
				return repeatInputLimitCheck;
			}
		}

		const outputLimitCheck = determineOutputLimit(context, modelData);
		if (!outputLimitCheck.success) {
			return outputLimitCheck;
		}
		const { outputLimit } = outputLimitCheck;

		const temperatureCheck = getTemperature(context);
		if (!temperatureCheck.success) {
			return temperatureCheck;
		}
		const { temperature } = temperatureCheck;

		const json: OpenAiPayload = {
			model: modelData.url,
			messages,
			user: getUserHash(context)
		};

		if (modelData.search !== true) {
			json.temperature = temperature;
			json.top_p = 1;
			json.frequency_penalty = 0;
			json.presence_penalty = 0;
		}

		if (modelData.usesCompletionTokens === true) {
			json.reasoning_effort = "minimal";
			json.max_completion_tokens = 1000;
		}
		else {
			json.max_tokens = outputLimit;
		}

		const response = await core.Got.get("GenericAPI")<OpenAiResponse>({
			method: "POST",
			throwHttpErrors: false,
			url: `https://api.openai.com/v1/chat/completions`,
			headers: {
				Authorization: `Bearer ${process.env.API_OPENAI_KEY}`
			},
			json
		});

		return {
			success: true,
			response
		};
	},

	getUsageRecord (response: GotResponse<OpenAiResponse>) {
		return response.body.usage.total_tokens;
	},
	getPromptTokens (response: GotResponse<OpenAiResponse>) {
		return response.body.usage.prompt_tokens;
	},
	getCompletionTokens (response: GotResponse<OpenAiResponse>) {
		return response.body.usage.completion_tokens;
	},
	getProcessingTime (response: GotResponse<OpenAiResponse>) {
		if (!response.headers["openai-processing-ms"]) {
			return null;
		}

		return Number(response.headers["openai-processing-ms"]);
	},
	extractMessage (context, response: GotResponse<OpenAiResponse>) {
		const message = response.body.choices[0].message.content.trim();
		if (context.platform.name === "twitch") {
			return (context.append.pipe)
				? trimMarkdownLinks(message)
				: removeMarkdownLinks(message);
		}
		else {
			return message;
		}
	},

	async setHistory (context: GptContext, query: string, reply: string) {
		const { historyMode } = await getHistoryMode(context);
		if (historyMode !== "enabled") {
			return;
		}

		if (context.params.image) {
			await GptHistory.imageAdd(context.user, query, context.params.image, reply);
		}
		else {
			await GptHistory.add(context.user, query, reply);
		}
	},

	isAvailable () { return Boolean(process.env.API_OPENAI_KEY); },
	getRequestErrorMessage () { return `The OpenAI service is overloaded at the moment! Try again later.`; }
} satisfies GptTemplate;
