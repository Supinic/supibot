import { api } from "../config.json";
import http from "node:http";
import https from "node:https";

import AfkDefinition from "./afk.js";
import ChannelDefinition from "./channel.js";
import CommandDefinition from "./command.js";
import FilterDefinition from "./filter.js";
import HealthDefinition from "./health.js";
import MetricsDefinition from "./metrics.js";
import PlatformDefinition from "./platform.js";
import ReminderDefinition from "./reminder.js";
import UserDefinition from "./user.js";

const definition = [
	AfkDefinition,
	ChannelDefinition,
	CommandDefinition,
	FilterDefinition,
	HealthDefinition,
	MetricsDefinition,
	PlatformDefinition,
	ReminderDefinition,
	UserDefinition
];

export default function initialize () {
	if (!api.port || typeof api.secure !== "boolean") {
		console.warn("Internal API port/security is not configured - internal API will not start");
		return;
	}

	const port = api.port;
	const protocol = (api.secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

	const httpInterface = (api.secure) ? https : http;
	const server = httpInterface.createServer(async (req, res) => {
		const url = new URL(req.url, baseURL);
		const path = url.pathname.split("/").filter(Boolean);

		let target = definition[path[0]];
		if (target && path.length === 1) {
			target = target.index;
		}
		else if (path.length > 1) {
			for (let i = 1; i < path.length; i++) {
				target = target?.[path[i]];
			}
		}

		if (!target) {
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({
				statusCode: 404,
				data: null,
				error: {
					path,
					message: "Endpoint not found"
				},
				timestamp: Date.now()
			}));

			return;
		}
		else if (typeof target !== "function") {
			throw new Error(`Internal API error - invalid definition for path ${path.join("/")}`);
		}

		const {
			skipResponseHandling = false,
			error = null,
			data = null,
			headers = {},
			statusCode = 200
		} = await target(req, res, url);

		if (!skipResponseHandling) {
			headers["Content-Type"] ??= "application/json";
			res.writeHead(statusCode, headers);

			res.end(JSON.stringify({
				statusCode,
				data,
				error,
				timestamp: Date.now()
			}));
		}
	});

	server.listen(port);

	return {
		server,
		definition,
		port
	};
};
