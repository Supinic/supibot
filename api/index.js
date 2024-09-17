const { api } = require("../config.json");

module.exports = (function () {
	if (!api.port || typeof api.secure !== "boolean") {
		console.warn("Internal API port/security is not configured - internal API will not start");
		return;
	}

	const definition = {};
	const subroutes = [
		["afk", "afk.js"],
		["channel", "channel.js"],
		["command", "command.js"],
		["filter", "filter.js"],
		["health", "health.js"],
		["metrics", "metrics.js"],
		["platform", "platform.js"],
		["reminder", "reminder.js"],
		["user", "user.js"]
	];
	for (const [route, file] of subroutes) {
		definition[route] = require(`./${file}`);
	}

	const port = api.port;
	const protocol = (api.secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

	const httpInterface = (api.secure) ? require("node:https") : require("node:http");
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
})();
