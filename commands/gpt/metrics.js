const process = (data) => {
	const { command, context, response, modelData, success } = data;
	const {
		prompt_tokens: inputTokens,
		completion_tokens: outputTokens
	} = response.body.usage;

	const labels = {
		channel: context.channel?.Name ?? "(private)",
		platform: context.platform.Name,
		model: modelData.name
	};

	const promptTokensCounter = command.registerMetric("Counter", "input_tokens_total", {
		help: "Total amount of input tokens used within GPT.",
		labelNames: ["channel", "platform", "model"]
	});

	const outputTokensCounter = command.registerMetric("Counter", "output_tokens_total", {
		help: "Total amount of output tokens used within GPT.",
		labelNames: ["channel", "platform", "model"]
	});

	const usageCounter = command.registerMetric("Counter", "usage_total", {
		help: "Total amount of times the GPT command has been used, with extra labels included.",
		labelNames: ["channel", "platform", "model", "success"]
	});

	const generationHistogram = command.registerMetric("Histogram", "generation_duration_milliseconds", {
		help: "Total amount of times the GPT command has been used, with extra labels included.",
		labelNames: ["model"]
	});

	promptTokensCounter.inc(labels, inputTokens);
	outputTokensCounter.inc(labels, outputTokens);
	usageCounter.inc({ ...labels, success }, 1);

	if (response.headers["openai-processing-ms"]) {
		const time = Number(response.headers["openai-processing-ms"]);
		generationHistogram.observe({ model: modelData.name }, time);
	}
};

module.exports = {
	process
};
