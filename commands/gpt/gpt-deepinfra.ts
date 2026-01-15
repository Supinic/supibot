import { type GotResponse, SupiError } from "supi-core";
import { getHistoryMode, getTemperature, determineOutputLimit, type GptTemplate } from "./gpt-template.js";
import { get as getHistoryEntry, add as addHistoryEntry } from "./history-control.js";
import type { GptContext } from "./index.js";
import type { ModelData } from "./config-schema.js";

type DeepinfraResponse = {
	created: number;
	id: string;
	model: string;
	object: string;
	choices: {
		finish_reason: string;
		index: number;
		logprobs: unknown;
		message: {
			content: string;
			name: unknown;
			role: "assistant";
			tool_calls: unknown;
		}
	}[];
	usage: {
		prompt_tokens: number;
		total_tokens: number;
		completion_tokens: number;
		estimated_cost: number;
	};
};

const getHistoryEntries = async (context: GptContext, query: string) => {
	const { historyMode } = await getHistoryMode(context);
	const promptHistory = (historyMode === "enabled")
		? await getHistoryEntry(context.user)
		: [];

	const systemMessage = "Keep the response as short and concise as possible.";
	return [
		{ role: "system", content: systemMessage },
		...promptHistory,
		{ role: "user", content: query }
	];
};

export const GptDeepInfra = {
	async execute (context: GptContext, query: string, modelData: ModelData) {
		if (!process.env.API_KEY_DEEPINFRA) {
			throw new SupiError({
				message: "No DeepInfra key configured (API_KEY_DEEPINFRA)"
			});
		}

		const temperatureCheck = getTemperature(context);
		if (!temperatureCheck.success) {
			return temperatureCheck;
		}

		const outputLimitCheck = determineOutputLimit(context, modelData);
		if (!outputLimitCheck.success) {
			return outputLimitCheck;
		}

		const { temperature } = temperatureCheck;
		const { outputLimit } = outputLimitCheck;

		const messages = await getHistoryEntries(context, query);

		const response = await core.Got.get("GenericAPI")<DeepinfraResponse>({
			method: "POST",
			url: `https://api.deepinfra.com/v1/openai/chat/completions`,
			headers: {
				Authorization: `Bearer ${process.env.API_KEY_DEEPINFRA}`
			},
			json: {
				model: modelData.url,
				messages,
				max_new_tokens: outputLimit,
				stream: false,
				temperature
			}
		});

		return {
			success: true,
			response
		};
	},

	getUsageRecord (response: GotResponse<DeepinfraResponse>) {
		return response.body.usage.total_tokens;
	},
	getPromptTokens (response: GotResponse<DeepinfraResponse>) {
		return response.body.usage.prompt_tokens;
	},
	getCompletionTokens (response: GotResponse<DeepinfraResponse>) {
		return response.body.usage.completion_tokens;
	},
	getProcessingTime () { return null; },
	extractMessage (context, response: GotResponse<DeepinfraResponse>) {
		return response.body.choices[0].message.content.trim();
	},

	async setHistory (context, query, reply) {
		const { historyMode } = await getHistoryMode(context);
		if (historyMode !== "enabled") {
			return;
		}

		await addHistoryEntry(context.user, query, reply);
	},

	isAvailable () { return Boolean(process.env.API_KEY_DEEPINFRA); },
	getRequestErrorMessage () {
		return `The DeepInfra service for this model is overloaded at the moment! Try again later.`;
	}
} satisfies GptTemplate;
