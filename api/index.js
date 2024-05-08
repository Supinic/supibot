module.exports = (function () {
	const secure = (sb.Config?.get("SUPIBOT_API_SECURE", false)) ?? false;
	const httpInterface = (secure) ? require("node:https") : require("node:http");
	const { URL } = require("node:url");

	const port = sb.Config?.get("SUPIBOT_API_PORT", false) ?? 31337;
	const protocol = (secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

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
