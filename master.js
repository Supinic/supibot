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
	const initialData = initialChannels.map(i => [i.Platform.Name, i.Platform.Host]);

	for (const [platformName, host] of initialData) {
		let Controller = null;
		try {
			Controller = require(`./controllers/${platformName}`);
		}
		catch (e) {
			console.error(`Require of ${platformName} controller module failed`, e);
			continue;
		}

		const options = { host };
		try {
			controllers[platformName] = new Controller(options);
		}
		catch (e) {
			console.error(`Initialization of ${platformName} controller module failed`, e);
			continue;
		}

		console.debug(`Platform ${platformName} loaded successfully.`);
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
