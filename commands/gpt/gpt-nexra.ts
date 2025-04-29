import { setTimeout as wait } from "node:timers/promises";

import { GptTemplate, getHistoryMode } from "./gpt-template.js";
import { get as getHistoryEntry, add as addHistoryEntry } from "./history-control.js";
import { GptContext, ModelData } from "./index.js";
import type { GotResponse } from "supi-core";

type NexraDetails = { created: number; time: number; duration: string; };
type NexraInitial = { id: string; status: "initiation"; };

type NexraPendingData = {
	status: "pending";
	detail: NexraDetails;
};
type NexraFailure = {
	status: "error" | "not_found";
};
type NexraComplementSuccess = {
	status: "completed";
	message: string;
	model: string;
	search: boolean;
	original: unknown;
};
type NexraSuccess = {
	status: "completed";
	gpt: string;
	model: string;
	original: unknown;
};
type PartialData<T> = NexraPendingData | NexraFailure | T;

const NO_YAPPING_PREFIX = "Answer briefly and do not go on any tangents.";
const STRONG_NO_YAPPING_PREFIX = "Answer very briefly and only what you are being asked for! Do not repeat your answer! Do not go on any tangents.";

const getHistoryEntries = async (context: GptContext) => {
	const { historyMode } = await getHistoryMode(context);
	return (historyMode === "enabled")
		? await getHistoryEntry(context.user)
		: [];
};

type TaskProcessResult <T> = {
	error: NexraFailure | undefined;
	response: GotResponse<T> | undefined;
};
const processResponseTask = async <T extends NexraSuccess | NexraComplementSuccess> (taskId: string): Promise<TaskProcessResult<T>> => {
	let response: GotResponse<T> | undefined;
	let error: NexraFailure | undefined;

	for (let i = 0; i < 30; i++) {
		const partialResponse = await core.Got.get("GenericAPI")<PartialData<T>>({
			method: "GET",
			url: `https://nexra.aryahcr.cc/api/chat/task/${encodeURIComponent(taskId)}`,
			throwHttpErrors: false,
			responseType: "json"
		});

		const { body } = partialResponse;
		if (body.status === "pending") {
			await wait(1000);
		}
		else if (body.status === "error" || body.status === "not_found") {
			error = body;
			break;
		}
		else {
			response = partialResponse as GotResponse<T>;
			break;
		}
	}

	return {
		error,
		response
	};
};

export const GptNexra = {
	async execute (context: GptContext, query: string, modelData: ModelData) {
		const messages = await getHistoryEntries(context);
		if (context.params.context) {
			messages.unshift({
				role: "user",
				content: context.params.context
			});
		}
		else {
			messages.unshift({
				role: "user",
				content: "Respond concisely, to the point, maximum 300 characters; unless I ask you for further detail."
			});
		}

		const initResponse = await core.Got.get("GenericAPI")<NexraInitial>({
			method: "POST",
			throwHttpErrors: false,
			responseType: "json",
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				messages,
				model: modelData.url,
				prompt: query,
				markdown: false
			}
		});

		if (!initResponse.ok) {
			return {
				success: false,
				reply: `Nexra API returned an error! Try again later.`
			};
		}

		const { error, response } = await processResponseTask<NexraSuccess>(initResponse.body.id);
		if (error || !response) {
			console.warn("Nexra API failure", { error, response, context, query });
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		return {
			success: true,
			response
		};
	},

	extractMessage (context, response: GotResponse<NexraSuccess>) {
		return response.body.gpt;
	},

	getUsageRecord () { return 0; },
	getCompletionTokens () { return 0; },
	getPromptTokens () { return 0; },
	getProcessingTime () { return null; },

	async setHistory (context, query, reply) {
		const { historyMode } = await getHistoryMode(context);
		if (historyMode === "enabled") {
			await addHistoryEntry(context.user, query, reply);
		}
	},

	isAvailable () { return true; },
	getRequestErrorMessage () { return "Nexra is currently overloaded! Try again later."; }
} satisfies GptTemplate;

export const GptNexraComplements = {
	...GptNexra,

	async execute (context: GptContext, query: string, modelData: ModelData) {
		const messages = await getHistoryEntries(context);
		const isYappingModel = Boolean(modelData.flags?.yapping);

		messages.push({
			role: "user",
			content: (isYappingModel)
				? `${STRONG_NO_YAPPING_PREFIX} ${query}`
				: `${NO_YAPPING_PREFIX} ${query}`
		});

		const initResponse = await core.Got.get("GenericAPI")<NexraInitial>({
			method: "POST",
			throwHttpErrors: false,
			responseType: "json",
			url: "https://nexra.aryahcr.cc/api/chat/complements",
			json: {
				messages,
				model: modelData.url,
				markdown: false,
				websearch: isYappingModel
			}
		});

		if (!initResponse.ok) {
			return {
				success: false,
				reply: `Nexra API returned an error! Try again later.`
			};
		}

		const { error, response } = await processResponseTask<NexraComplementSuccess>(initResponse.body.id);
		if (error || !response) {
			console.warn("Nexra API failure", { error, response, context, query });
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		if (isYappingModel) {
			const cleanupArray = response.body.message.split(/ {2,}/);
			response.body.message = cleanupArray[0];
		}

		return {
			success: true,
			response
		};
	},

	extractMessage (context, response: GotResponse<NexraComplementSuccess>) {
		return response.body.message;
	}
} satisfies GptTemplate;
