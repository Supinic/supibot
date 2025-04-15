import { SupiError } from "supi-core";
import type { GptContext } from "./index.js";

type ModerationCategory =
	| "harrassment" | "harrassment/threatening"
	| "hate" | "hate/threatening"
	| "self-harm" | "self-harm/instructions" | "self-harm/intent"
	| "sexual" | "sexual/minors"
	| "violence" | "violence/graphic";

type ModerationResult = {
	categories: Record<ModerationCategory, boolean>;
	category_scores: Record<ModerationCategory, number>;
};
type ModerationResponse = {
	id: string;
	model: string;
	results: ModerationResult[];
};

export const check = async (context: GptContext, text: string) => {
	if (!process.env.API_OPENAI_KEY) {
		throw new SupiError({
			message: "No OpenAI key configured (API_OPENAI_KEY)"
		});
	}

	text = text.trim();

	const moderationCheck = await core.Got.get("GenericAPI")<ModerationResponse>({
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
