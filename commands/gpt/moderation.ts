import { SupiError } from "supi-core";
import type { GptContext } from "./index.js";
import { typedEntries } from "../../utils/ts-helpers.js";

type ModerationCategory =
	| "harrassment" | "harrassment/threatening"
	| "hate" | "hate/threatening"
	| "illicit" | "illicit/violent"
	| "self-harm" | "self-harm/instructions" | "self-harm/intent"
	| "sexual" | "sexual/minors"
	| "violence" | "violence/graphic";

type ModerationResult = {
	categories: Record<ModerationCategory, boolean>;
	category_scores: Record<ModerationCategory, number>;
};
type ImageModerationResult = ModerationResult & {
	category_applied_input_types: Record<ModerationCategory, [] | ["image"]>;
};
type ModerationResponse = {
	id: string;
	model: string;
	results: ModerationResult[];
};
type ImageModerationResponse = {
	id: string;
	model: string;
	results: ImageModerationResult[];
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

export const checkImage = async (url: string) => {
	if (!process.env.API_OPENAI_KEY) {
		throw new SupiError({
			message: "No OpenAI key configured (API_OPENAI_KEY)"
		});
	}

	const moderationCheck = await core.Got.get("GenericAPI")<ImageModerationResponse>({
		method: "POST",
		throwHttpErrors: false,
		url: `https://api.openai.com/v1/moderations`,
		headers: {
			Authorization: `Bearer ${process.env.API_OPENAI_KEY}`
		},
		json: {
			input: [{
				image_url: { url },
				type: "image_url"
			}]
		}
	});

	if (!moderationCheck.ok || !Array.isArray(moderationCheck.body.results)) {
		return {
			success: false
		} as const;
	}

	const [moderationResult] = moderationCheck.body.results;
	const { categories, category_scores: scores, category_applied_input_types: types } = moderationResult;

	const categoryResult: Partial<Record<ModerationCategory, boolean>> = {};
	const scoreResult: Partial<Record<ModerationCategory, number>> = {};
	for (const [key, value] of typedEntries(types)) {
		if (value.length === 0) {
			continue;
		}

		scoreResult[key] = scores[key];
		categoryResult[key] = categories[key];
	}

	return {
		success: true,
		scores: scoreResult,
		categories: categoryResult
	} as const;
};
