import definitions from "./definitions.js";
import prometheusConfig from "./prometheus-config.json" with { type: "json" };

const { baseUrl } = prometheusConfig;

export default {
	Name: "metrics",
	Aliases: [],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Shows off various metrics related to Supibot - e.g. current commands per minute.",
	Flags: [],
	Params: null,
	Whitelist_Response: null,
	Code: async function metrics (context, type) {
		if (!type) {
			return {
				success: false,
				reply: `You did not provide any metric name! Use "commands-per-minute", for example, or check this command's help for a full list.`
			};
		}

		type = type.toLowerCase();

		const definition = definitions.find(i => i.name === type || i.aliases.includes(type));
		if (!definition) {
			return {
				success: false,
				reply: `You did not provide any valid metric name!`
			};
		}

		let reply;
		if (definition.type === "basic") {
			const response = await sb.Got.get("GenericAPI")({
				url: `${baseUrl}/query`,
				searchParams: {
					query: definition.query
				}
			});

			if (!response.ok || response.body.status !== "success") {
				return {
					success: false,
					reply: `The Prometheus metrics API is currently out of order! Try again later.`
				};
			}

			/** @type {PrometheusApiResponse} */
			const data = response.body;
			const { metric, value } = data.data.result[0];

			reply = definition.format(Number(value[1]), metric);
		}

		if (!reply) {
			return {
				success: false,
				reply: `No result has been generated from the Prometheus metrics API! Try again later.`
			};
		}
		else {
			return {
				reply
			};
		}
	},
	Dynamic_Description: async () => {
		const list = definitions.flatMap(i => [...i.description, "", ""]);
		return [
			`Queries the Prometheus metrics API to give out various fun statistics about Supibot!`,
			"",

			...list
		];
	}
};

/**
 * @typedef {Object} PrometheusApiResponse
 * @property {Object} data
 * @property {PrometheusApiResult[]} data.result
 * @property {string} data.resultType
 * @property {"success"} status
 */

/**
 * @typedef {Object} PrometheusApiResult
 * @property {Object} metric
 * @property {[number, string]} value
 */
