const Template = require("./gpt-template.js");

module.exports = class GptString extends Template {
	static async execute (context, query, modelData) {
		const inputLimitCheck = super.checkInputLimits(modelData, query.length);
		if (inputLimitCheck.success === false) {
			return inputLimitCheck;
		}

		const outputLimitCheck = super.determineOutputLimit(context, modelData);
		if (outputLimitCheck.success === false) {
			return outputLimitCheck;
		}
		const { outputLimit } = outputLimitCheck;

		const temperatureCheck = super.getTemperature(context);
		if (temperatureCheck.success === false) {
			return temperatureCheck;
		}
		const { temperature } = temperatureCheck;

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: `https://api.openai.com/v1/completions`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_OPENAI_KEY")}`
			},
			json: {
				model: modelData.url,
				prompt: query,
				max_tokens: outputLimit,
				temperature,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				user: super.getUserHash(context)
			}
		});

		return { response };
	}

	static isAvailable () {
		return sb.Config.has("API_OPENAI_KEY", true);
	}

	static extractMessage (response) {
		return response.body.choices[0].text.trim();
	}
};
