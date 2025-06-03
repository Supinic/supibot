import type { Context } from "../../../classes/command.js";
import { isModelName as isGptModelName } from "../../gpt/index.js";

export default {
	name: "default-gpt-model",
	aliases: ["gpt-model"],
	parameter: "arguments",
	description: "Lets you set a default GPT model from one of the supported ones for the $gpt command.",
	flags: {
		pipe: false
	},
	set: async (context: Context, ...args: string[]) => {
		const identifier = args.join(" ");
		if (!identifier) {
			return {
				success: false,
				reply: "No model name provided!"
			};
		}
		else if (!isGptModelName(identifier)) {
			return {
			    success: false,
			    reply: "Invalid model name provided!"
			};
		}

		const previous = await context.user.getDataProperty("defaultGptModel");
		await context.user.setDataProperty("defaultGptModel", identifier);

		const string = (previous)
			? `changed your default $gpt model from ${previous} to ${identifier}`
			: `set your default gpt model to ${identifier}`;

		return {
			success: true,
			reply: `Successfully ${string}.`
		};
	},
	unset: async (context: Context) => {
		const existing = await context.user.getDataProperty("defaultGptModel");
		if (!existing) {
			return {
				success: false,
				reply: `You don't have a default $gpt model set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty("defaultGptModel", null);
		return {
			success: true,
			reply: `Successfully unset your default gpt model.`
		};
	}
};
