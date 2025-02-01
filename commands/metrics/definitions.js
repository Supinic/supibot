export default [
	{
		name: "commands-per-minute",
		aliases: ["cpm"],
		description: [
			"<code>$metrics commands-per-minute</code>",
			"<code>$metrics cpm</code>",
			"Shows how many commands Supibot is currently executing globally, per minute."
		],
		type: "basic",
		query: "sum(rate(supibot_command_executions_total[1h]))*60",
		format: (result) => `Supibot is currently executing ${sb.Utils.round(result, 2)} commands per minute.`
	},
	{
		name: "read-messages-per-minute",
		aliases: ["rmpm"],
		description: [
			"<code>$metrics read-messages-per-minute</code>",
			"<code>$metrics rmpm</code>",
			"Shows how many messages Supibot reads per minute, in all the channels it is in, combined."
		],
		type: "basic",
		query: "sum(rate(supibot_messages_read_total[1h]))*60",
		format: (result) => `Supibot is currently reading ${sb.Utils.round(result, 2)} messages per minute.`
	},
	{
		name: "top-messages-channel",
		aliases: ["tmc"],
		description: [
			"<code>$metrics top-messages-channel</code>",
			"<code>$metrics tmc</code>",
			"Shows the top channel sorted by how many messages per minute are being sent in it, plus the value as well."
		],
		type: "basic",
		query: "topk(1, rate(supibot_messages_read_total[5m])) * 60",
		format: (result, metric) => `Currently, the fastest channel with Supibot is ${metric.channel}, with ${sb.Utils.round(result, 2)} messages per minute.`
	}
];
