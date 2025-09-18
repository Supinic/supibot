import * as z from "zod";
import raw from "./config.json" with { type: "json" };
import ConfigSchema from "./utils/config-validation.js";

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;
export function getConfig (): Config {
	return (cached ??= ConfigSchema.parse(raw));
}
