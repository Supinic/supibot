import type { ParameterDefinition, ParamFromDefinition } from "../../classes/command.js";

export const newsParams = [
	{ name: "country", type: "string" },
	{ name: "latest", type: "boolean" },
	{ name: "link", type: "boolean" }
] as const satisfies ParameterDefinition[];

type NewsParams = typeof newsParams;
export type NewsOptions = {
	params: ParamFromDefinition<NewsParams>,
	limit: number;
};
