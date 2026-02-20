import config from "../config.json" with { type: "json" };
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
import { JSONifiable } from "../@types/globals.js";
import error from "supi-core/build/objects/error.js";

type ApiDataSuccess = {
	statusCode?: number;
	data: Record<string, JSONifiable>;
	headers?: Record<string, string>;
};
type ApiSkipSuccess = { skipResponseHandling: true; };
type ApiSuccessResponse = ApiDataSuccess | ApiSkipSuccess;
type ApiFailureResponse = {
	statusCode: number;
	error: {
		message: string;
		reason?: string;
	};
	headers?: Record<string, string>;
};
type ApiResponse = ApiSuccessResponse | ApiFailureResponse;
type ApiFunction = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => Promise<ApiResponse>;
export type ApiDefinition = Record<string, ApiFunction>;

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

const routes = Object.keys(routeDefinitions);

const isValidRoute = (input: string): input is keyof typeof routeDefinitions => routes.includes(input);
const isValidEndpoint = (route: ApiDefinition, input: string): input is keyof typeof route => {
	const endpoints = Object.keys(route);
	return endpoints.includes(input);
};

const handleNotFound = (res: http.ServerResponse, path: string) => {
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
};

async function handler (req: http.IncomingMessage, res: http.ServerResponse, baseUrl: string) {
	if (!req.url) {
		return;
	}

	const url = new URL(req.url, baseUrl);
	const [route, endpoint] = url.pathname.split("/").filter(Boolean);
	if (!isValidRoute(route)) {
		handleNotFound(res, route);
		return;
	}

	const routeDefinition = routeDefinitions[route];
	if (!isValidEndpoint(routeDefinition, endpoint)) {
		handleNotFound(res, `${route}/${endpoint}`);
		return;
	}

	const endpointDefinition = routeDefinition[endpoint];
	const result = await endpointDefinition(req, res, url);

	if (!("skipResponseHandling" in result)) {
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
	}
}

export default function initialize () {
	const { api } = config;
	if (!api.port || typeof api.secure !== "boolean") {
		console.warn("Internal API port/security is not configured - internal API will not start");
		return;
	}

	const port = api.port;
	const protocol = (api.secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

	const server = (api.secure)
		? https.createServer((req, res) => void handler(req, res, baseURL))
		: http.createServer((req, res) => void handler(req, res, baseURL));

	/*
	const server = httpInterface.createServer(async (req, res) => {
		const url = new URL(req.url, baseURL);
		const path = url.pathname.split("/").filter(Boolean);

		let target = routeDefinitions[path[0]];
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
*/

	server.listen(port);

	return {
		server,
		routeDefinitions,
		port
	};
};
