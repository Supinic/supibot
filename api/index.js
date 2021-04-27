module.exports = (function () {
	const secure = (sb.Config?.get("SUPIBOT_API_SECURE", false)) ?? false;
	const httpInterface = (secure) ? require("https") : require("http");
	const { URL } = require("url");

	const port = sb.Config?.get("SUPIBOT_API_PORT", false) ?? 80;
	const protocol = (secure) ? "https" : "http";
	const baseURL = `${protocol}://localhost:${port}`;

	const definition = {};
	const subroutes = [
		["channel", "channel.js"],
		["reminder", "reminder.js"],
	];
	for (const [route, file] of subroutes) {
		definition[route] = require("./" + file);
	}

	const server = httpInterface.createServer(async (req, res) => {
		const url = new URL(req.url, baseURL);
		const path = url.pathname.split("/").filter(Boolean);

		let target = definition[path[0]];
		for (let i = 1; i < path.length; i++) {
			target = target?.[path[i]];
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
			throw new Error("Internal API error - invalid definition for path " + path.join("/"));
		}

		const { error = null, data = null, headers = {}, statusCode = 200 } = await target(req, res, url);
		res.writeHead(statusCode, headers);
		res.end(JSON.stringify({
			statusCode,
			data,
			error,
			timestamp: Date.now()
		}));
	});

	server.listen(port);

	return {
		server,
		definition
	};
})();