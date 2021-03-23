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
	const initialPlatforms = new Set(initialChannels.map(i => i.Platform.Name));
	for (const platform of initialPlatforms) {
		let Controller = null;
		try {
			Controller = require("./controllers/" + platform);
		}
		catch (e) {
			console.error("Require of " + platform + " controller module failed", e);
			continue;
		}

		try {
			controllers[platform] = new Controller();
		}
		catch (e) {
			console.error("Initialization of " + platform + " controller module failed", e);
			continue;
		}

		console.debug(`Platform ${platform} loaded successfully.`);
	}

	sb.Platform.assignControllers(controllers);
})();