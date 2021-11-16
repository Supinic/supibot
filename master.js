(async function () {
	"use strict";

	process.env.PROJECT_TYPE = "bot";

	/** Database access keys are loaded here, and stored to process.env */
	require("./db-access");

	/**
	 * The global bot namespace.
	 * Used for various utilities, prototype changes and custom classes.
	 * Assigned to global.sb upon requiring the globals module.
	 */
	await require("supi-core")("sb");

	const controllers = {};
	const initialChannels = sb.Channel.data.filter(i => i.Mode !== "Inactive");
	const initialPlatforms = initialChannels.map(i => i.Platform);

	for (const platformData of initialPlatforms) {
		let Controller = null;
		try {
			Controller = require(`./controllers/${platformData.Name}`);
		}
		catch (e) {
			console.error(`Require of ${platformData.Name} controller module failed`, e);
			continue;
		}

		const options = { host: platformData.Host };
		try {
			controllers[platformData.Name] = new Controller(options);
		}
		catch (e) {
			console.error(`Initialization of ${platformData.Name} controller module failed`, e);
			continue;
		}

		console.debug(`Platform ${platformData.Name} loaded successfully.`);
	}

	sb.API = require("./api");

	sb.Platform.assignControllers(controllers);

	process.on("unhandledRejection", async (reason) => {
		if (!(reason instanceof Error)) {
			return;
		}

		try {
			await sb.Logger.logError("Backend", reason, {
				origin: "Internal",
				context: {
					cause: "UnhandledPromiseRejection"
				}
			});
		}
		catch {
			console.warn("Rejected the promise of promise rejection handler", { reason });
		}
	});
})();
