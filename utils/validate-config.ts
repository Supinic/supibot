import { ZodError } from "zod";
import ConfigSchema from "./config-validation.js";
import config from "../config.json" with { type: "json" };

try {
	ConfigSchema.parse(config);
	console.log("config ok");
}
catch (e) {
	if (!(e instanceof ZodError)) {
		throw e;
	}

	console.error("config invalid");
	for (const issue of e.issues) {
		console.error(
			`• [${issue.path.join(".") || "(root)"}] ${issue.message}`
		);
	}
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(1);
}
