import type * as z from "zod";
import { readFile } from "node:fs/promises";

const raw = await readFile("./config.json");
import { ConfigSchema } from "./utils/config-validation-schema.js";

type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;
export function getConfig (): Config {
	if (!cached) {
		const rawJson: unknown = JSON.parse(raw.toString());
		cached = ConfigSchema.parse(rawJson);
	}

	return cached;
}
