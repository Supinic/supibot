import { createHash } from "node:crypto";

import config from "./config.json" with { type: "json" };
import History from "./history-control.js";
import type { GptContext, ModelData } from "./index.js";

import type { GotResponse } from "supi-core"; // @todo why error type???

type ExecuteFailure = {
	success: false;
	reply: string;
	cooldown?: number;
};
type HistorySuccess = {
	success: true;
	reply: string;
	cooldown?: number;
};
type OutputLimit = {
	success: true;
	outputLimit: number;
};
type InputLimitCheck = {
	success: true;
};
type Temperature = {
	success: true;
	temperature: number | undefined;
};
type GptHistoryMode = "enabled" | "disabled";

export const determineOutputLimit = (context: GptContext, modelData: ModelData): OutputLimit | ExecuteFailure => {
	const { limit } = context.params;
	let outputLimit = modelData.outputLimit.default;

	if (typeof limit === "number") {
		if (!core.Utils.isValidInteger(limit)) {
			return {
				success: false,
				reply: `Your provided output limit must be a positive integer!`,
				cooldown: 2500
			};
		}

		const maximum = modelData.outputLimit.maximum;
		if (limit > maximum) {
			return {
				success: false,
				cooldown: 2500,
				reply: core.Utils.tag.trim `
					Maximum output limit exceeded for this model!
					Lower your limit, or use a lower-ranked model instead.
					${limit}/${maximum}
				`
			};
		}

		outputLimit = limit;
	}

	return {
		success: true,
		outputLimit
	};
};

export const checkInputLimits = (modelData: ModelData, queryLength: number): InputLimitCheck | ExecuteFailure => {
	if (modelData.inputLimit && queryLength > modelData.inputLimit) {
		const errorMessages = config.lengthLimitExceededMessage;
		return {
			success: false,
			cooldown: 2500,
			reply: `${errorMessages.history} ${queryLength}/${modelData.inputLimit}`
		};
	}
	else if (!modelData.inputLimit && queryLength > config.globalInputLimit) {
		return {
			success: false,
			cooldown: 2500,
			reply: `Maximum query length exceeded! ${queryLength}/${config.globalInputLimit}`
		};
	}

	return {
		success: true
	};
};

export const getTemperature = (context: GptContext): Temperature | ExecuteFailure => {
	const { temperature } = context.params;
	if (typeof temperature === "number" && (temperature < 0 || temperature > 2)) {
		return {
			success: false,
			reply: `Your provided temperature is outside of the valid range! Use a value between 0.0 and 2.0 - inclusive.`,
			cooldown: 2500
		};
	}

	return {
		success: true,
		temperature
	};
};

export const getUserHash = (context: GptContext) => (
	createHash("sha1")
		.update(context.user.Name)
		.update(context.platform.name)
		.digest()
		.toString("hex")
);

export const handleHistoryCommand = async (context: GptContext, query: string): Promise<HistorySuccess | ExecuteFailure | undefined> => {
	if (!context.params.history) {
		return;
	}

	const command = context.params.history;
	const historyMode = await context.user.getDataProperty("chatGptHistoryMode") ?? config.defaultHistoryMode;
	if (command === "enable" || command === "disable") {
		if (historyMode === command) {
			return {
				success: false,
				reply: `Your ChatGPT history is already ${command}d!`,
				cooldown: 2500
			};
		}

		const state = `${command}d`;
		await context.user.setDataProperty("chatGptHistoryMode", state);
		return {
			success: true,
			reply: `Your ChatGPT history was successfully ${command}d.`,
			cooldown: 5000
		};
	}
	else if (command === "clear" || command === "reset") {
		await History.reset(context.user);

		// If no query provided, return immediately. Otherwise, continue with cleared history as normal.
		if (!query) {
			return {
				success: true,
				reply: "Successfully cleared your ChatGPT history."
			};
		}
	}
	else if (command === "export" || command === "check") {
		return await History.dump(context.user);
	}
};

export const getHistoryMode = async (context: GptContext) => {
	let historyMode = (await context.user.getDataProperty("chatGptHistoryMode") ?? config.defaultHistoryMode) as GptHistoryMode;
	if (context.params.history) {
		const command = context.params.history;
		if (command === "ignore") {
			historyMode = "disabled";
		}
	}

	return { historyMode };
};

type ExecuteSuccess = {
	success: true;
	response: GotResponse;
};
export interface GptTemplate {
	isAvailable (): boolean;
	getUsageRecord (response: GotResponse): number | null;
	getPromptTokens (response: GotResponse): number | null;
	getCompletionTokens (response: GotResponse): number | null;
	getProcessingTime (response: GotResponse): number | null;

	execute (context: GptContext, query: string, modelData: ModelData): Promise<ExecuteSuccess | ExecuteFailure>;
	extractMessage (response: GotResponse): string;
	setHistory (context: GptContext, query: string, reply: string): Promise<void>;
	getRequestErrorMessage (): string;
}
