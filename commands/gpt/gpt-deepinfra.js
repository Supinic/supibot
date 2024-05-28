const GptOpenAI = require("./gpt-openai.js");
const GptHistory = require("./history-control.js");

module.exports = class GptDeepInfra extends GptOpenAI {
	static formatQuery (query) {
		return `[INST] ${query} [/INST]`;
	}

	static async getHistory (context) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		return (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];
	}

	static async execute (context, query, modelData) {
		const temperatureCheck = super.getTemperature(context);
		if (temperatureCheck.success === false) {
			return temperatureCheck;
		}

		const outputLimitCheck = super.determineOutputLimit(context, modelData);
		if (outputLimitCheck.success === false) {
			return outputLimitCheck;
		}

		const { temperature } = temperatureCheck;
		const { outputLimit } = outputLimitCheck;

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://api.deepinfra.com/v1/inference/${modelData.url}`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_KEY_DEEPINFRA")}`
			},
			json: {
				input: GptDeepInfra.formatQuery(query),
				max_new_tokens: outputLimit,
				temperature
			}
		});

		return { response };
	}

	static extractMessage (response) {
		return response.body.results[0].generated_text;
	}

	static getUsageRecord () { return 0; }
	static getPromptTokens () { return 0; }
	static setHistory () {}

	static getCompletionTokens (response) {
		return response.body.num_tokens;
	}

	static getProcessingTime (response) {
		return response.body.inference_status.runtime_ms;
	}

	static isAvailable () {
		return sb.Config.has("API_KEY_DEEPINFRA", true);
	}
};
