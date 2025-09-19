import * as z from "zod";

const num = z.int().positive();
const userTokenLimit = z
	.object({ hourly: num, daily: num })
	.refine(
		data => (data.daily > data.hourly),
		{
			error: "`daily` must be greater than `hourly`",
			path: ["daily"]
		}
	);
const tokenLimit = z
	.object({ default: num, maximum: num })
	.refine(
		data => (data.maximum > data.default),
		{
			message: "`maximum` must be greater than `default`",
			path: ["maximum"]
		}
	);

export default z.object({
	defaultTemperature: z.float32().min(0).max(2),
	defaultHistoryMode: z.enum(["enabled", "disabled"]),
	globalInputLimit: num,
	outputLimit: tokenLimit,
	lengthLimitExceededMessage: z.object({
		history: z.string(),
		regular: z.string()
	}),
	userTokenLimits: z.object({
		regular: userTokenLimit,
		subscriber: userTokenLimit
	}),
	models: z.record(
		z.string(),
		z.object({
			url: z.string(),
			type: z.enum(["openai", "deepinfra"]),
			default: z.boolean(),
			inputLimit: num,
			outputLimit: tokenLimit,
			flatCost: num.optional(),
			pricePerMtoken: z.float32().positive(),
			search: z.boolean().optional(),
			usesCompletionTokens: z.boolean().optional(),
			subscriberOnly: z.boolean().optional(),
			disabled: z.boolean().optional(),
			disableReason: z.string().optional()
		})
	)
});
