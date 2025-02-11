import type { CronJob } from "cron";

export type CronArgument = {
	name: CronDefinition["name"];
	description: CronDefinition["description"];
	code: CronDefinition["code"];
	job: CronJob;
};

export type CronDefinition = {
	name: string;
	expression: string;
	description: string;
	code: (cron: CronArgument) => Promise<void>;
};

