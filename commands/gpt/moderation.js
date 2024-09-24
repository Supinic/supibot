const check = async (context, text) => {
	if (!process.env.API_OPENAI_KEY) {
		throw new sb.Error({
			message: "No OpenAI key configured (API_OPENAI_KEY)"
		});
	}

	text = text.trim();

	const moderationCheck = await sb.Got("GenericAPI", {
		method: "POST",
		throwHttpErrors: false,
		url: `https://api.openai.com/v1/moderations`,
		headers: {
			Authorization: `Bearer ${process.env.API_OPENAI_KEY}`
		},
		json: {
			input: text
		}
	});

	if (!moderationCheck.ok || !Array.isArray(moderationCheck.body.results)) {
		const logId = await sb.Logger.log(
			"Command.Warning",
			`GPT moderation failed! ${JSON.stringify({ body: moderationCheck.body })}`,
			context.channel,
			context.user
		);

		return {
			success: false,
			reply: `Could not check your response for moderation! Please try again later. Reference ID: ${logId}`
		};
	}

	const [moderationResult] = moderationCheck.body.results;
	const { categories, category_scores: scores } = moderationResult;
	if (categories.hate || categories["violence/graphic"] || categories["sexual/minors"]) {
		const logId = await sb.Logger.log(
			"Command.Warning",
			`Unsafe GPT content generated! ${JSON.stringify({ text, scores })}`,
			context.channel,
			context.user
		);

		return {
			success: false,
			reply: `Unsafe content generated! Reference ID: ${logId}`
		};
	}

	return {
		success: true
	};
};

module.exports = {
	check
};
