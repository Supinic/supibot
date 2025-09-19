/* eslint-disable unicorn/no-process-exit */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ZodError } from "zod";
import { ConfigSchema } from "./config-validation-schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, "..", "config.json");

try {
	const raw = await readFile(configPath);
	const rawJson: unknown = JSON.parse(raw.toString());
	ConfigSchema.parse(rawJson);
	console.log("config ok");
}
catch (e) {
	if (!(e instanceof ZodError)) {
		console.error(e);
		process.exit(1);
	}

	console.error("config invalid");
	for (const issue of e.issues) {
		console.error(
			`• [${issue.path.join(".") || "(root)"}] ${issue.message}`
		);
	}
	process.exit(1);
}
