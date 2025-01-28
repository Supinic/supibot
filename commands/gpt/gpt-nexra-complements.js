const { setTimeout: wait } = require("node:timers/promises");

const GptOpenAI = require("./gpt-openai.js");
const GptHistory = require("./history-control.js");

const NO_YAPPING_PREFIX = "Answer briefly and do not go on any tangents.";
const STRONG_NO_YAPPING_PREFIX = "Answer very briefly and only what you are being asked for! Do not repeat your answer! Do not go on any tangents.";

module.exports = class GptNexraComplements extends GptOpenAI {
	static async getHistory (context) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		return (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];
	}

	static async execute (context, query, modelData) {
		const messages = await this.getHistory(context);
		const isYappingModel = Boolean(modelData.flags?.yapping);

		messages.push({
			role: "user",
			content: (isYappingModel)
				? `${STRONG_NO_YAPPING_PREFIX} ${query}`
				: `${NO_YAPPING_PREFIX} ${query}`
		});

		const initResponse = await sb.Got.get("GenericAPI")({
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

		let response;
		let error;
		const taskId = initResponse.body.id;
		for (let i = 0; i < 30; i++) {
			const partialResponse = await sb.Got.get("GenericAPI")({
				method: "GET",
				throwHttpErrors: false,
				responseType: "json",
				url: `https://nexra.aryahcr.cc/api/chat/task/${encodeURIComponent(taskId)}`
			});

			const { status } = partialResponse.body;
			if (status === "pending") {
				await wait(2500);
			}
			else if (status === "error" || status === "not_found") {
				error = partialResponse;
				break;
			}
			else if (status === "completed") {
				response = partialResponse;
				break;
			}
		}

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

		return { response };
	}

	static extractMessage (response) {
		return response.body.message;
	}

	static getUsageRecord () { return 0; }
	static getCompletionTokens () { return 0; }
	static getPromptTokens () { return 0; }
	static getProcessingTime () { return null; }
	static isAvailable () { return true; }

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		if (historyMode === "enabled") {
			await GptHistory.add(context.user, query, reply);
		}
	}

	static getRequestErrorMessage () {
		return "Nexra is currently overloaded! Try again later.";
	}
};
