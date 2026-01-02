import * as z from "zod";
import { SupiError } from "supi-core";

import type { CheckSubcommandDefinition } from "../index.js";

const deeplUsageSchema = z.object({
	character_count: z.int(),
	character_limit: z.int().min(1)
});

export default {
	name: "deepl",
	title: "DeepL usage limits",
	aliases: ["DeepL"],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}check deepl</code>`,
		`Checks the current usage limits of the DeepL translation engine in the <a href="/bot/command/detail/deepl/">${prefix}deepl</a> command.`
	],
	execute: async () => {
		if (!process.env.API_DEEPL_KEY) {
			throw new SupiError({
				message: "No DeepL key configured (API_DEEPL_KEY)"
			});
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://api-free.deepl.com/v2/usage",
			headers: {
				Authorization: `DeepL-Auth-Key ${process.env.API_DEEPL_KEY}`
			}
		});

		const data = deeplUsageSchema.parse(response.body);
		const current = core.Utils.groupDigits(data.character_count);
		const max = core.Utils.groupDigits(data.character_limit);
		const percentage = core.Utils.round((data.character_count / data.character_limit) * 100, 2);

		return {
			reply: `Current usage of DeepL engine API: ${current} characters used out of ${max}, which is ${percentage}%`
		};
	}
} satisfies CheckSubcommandDefinition;
