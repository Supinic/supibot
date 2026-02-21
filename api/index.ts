import { getConfig } from "../config.js";
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

import type { JSONifiable } from "../utils/globals.js";

type ApiSuccess = {
	statusCode: number;
	data: JSONifiable;
	headers?: Record<string, string>;
};
type ApiSkip = { skipResponseHandling: true; };
type ApiFailure = {
	statusCode: number;
	error: {
		message: string;
		reason?: string;
	};
	headers?: Record<string, string>;
};
type ApiResponse = ApiSuccess | ApiSkip | ApiFailure;
type ApiFunction = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => ApiResponse | Promise<ApiResponse>;
export type ApiDefinition = Record<string, ApiFunction>;

const router = new Map<string, Map<string, ApiFunction>>();
const routeDefinitions: Record<string, ApiDefinition> = {
	afk: AfkDefinition,
	channel: ChannelDefinition,
	command: CommandDefinition,
	filter: FilterDefinition,
	health: HealthDefinition,
	metrics: MetricsDefinition,
	platform: PlatformDefinition,
	reminder: ReminderDefinition,
	user: UserDefinition
};

const handleNotFound = (res: http.ServerResponse, path: string) => {
	res.statusCode = 404;
	res.end(`Not found: ${path}`);
};

const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse, baseUrl: string) => {
	if (!req.url) {
		return;
	}

	const url = new URL(req.url ?? "/", baseUrl);
	const [route, endpoint] = url.pathname.split("/").filter(Boolean);
	if (!route || !endpoint) {
		handleNotFound(res, "malformed path");
		return;
	}

	const handler = router.get(route)?.get(endpoint);
	if (!handler) {
		handleNotFound(res, `${route}/${endpoint}`);
		return;
	}

	const result = await handler(req, res, url);
	if ("skipResponseHandling" in result) {
		return;
	}

	const { headers = {}, statusCode = 200 } = result;
	const data = ("data" in result) ? result.data : null;
	const error = ("error" in result) ? result.error : null;

	headers["Content-Type"] ??= "application/json";
	res.writeHead(statusCode, headers);

	res.end(JSON.stringify({
		statusCode,
		data,
		error,
		timestamp: Date.now()
	}));
};

export default function initialize () {
	const { api } = getConfig();
	if (!api || !api.port || typeof api.secure !== "boolean") {
		console.warn("Internal API port/security is not configured - internal API will not start");
		return;
	}

	const port = api.port;
	const protocol = (api.secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

	const server = (api.secure)
		? https.createServer((req, res) => void handleRequest(req, res, baseURL))
		: http.createServer((req, res) => void handleRequest(req, res, baseURL));

	for (const [routeName, endpoints] of Object.entries(routeDefinitions)) {
		const endpointMap = new Map<string, ApiFunction>();
		for (const [endpoint, handler] of Object.entries(endpoints)) {
			endpointMap.set(endpoint, handler);
		}

		router.set(routeName, endpointMap);
	}

	server.listen(port);

	return { server, routeDefinitions, port };
};
