const GptOpenAI = require("./gpt-openai.js");
const GptHistory = require("./history-control.js");

module.exports = class GptDeepInfra extends GptOpenAI {
	static async getHistory (context, query) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		const promptHistory = (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];

		const systemMessage = "Keep the response as short and concise as possible.";
		return [
			{ role: "system", content: systemMessage },
			...promptHistory,
			{ role: "user", content: query }
		];
	}

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptDeepInfra.getHistoryMode(context);
		if (historyMode !== "enabled") {
			return;
		}

		await GptHistory.add(context.user, query, reply);
	}

	static async execute (context, query, modelData) {
		if (!process.env.API_KEY_DEEPINFRA) {
			throw new sb.Error({
				messsage: "No DeepInfra key configured (API_KEY_DEEPINFRA)"
			});
		}

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

		const messages = await GptDeepInfra.getHistory(context, query);

		const response = await sb.Got("GenericAPI", {
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

		return { response };
	}

	static isAvailable () {
		return Boolean(process.env.API_KEY_DEEPINFRA);
	}

	static getRequestErrorMessage () {
		return `The DeepInfra service for this model is overloaded at the moment! Try again later.`;
	}
};
