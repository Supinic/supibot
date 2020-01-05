/* global sb */
/**
 * Super-class for any modules implemented
 * @memberof sb
 * @namespace Module
 */
module.exports = (async function () {
	"use strict";

	/** @interface */
	class Module {
		/**
		 * Cleans up the module.
		 * All sub-classes must implement this method.
		 * @abstract
		 */
		destroy () {
			throw new sb.Error({ message: "Module.destroy is not implemented!" });
		}

		/**
		 * Reloads a given module.
		 */
		reload () {
			this.destroy();
			sb[this.name] = null;

			delete require.cache[require.resolve(__dirname + "/" + (this.modulePath || this.name))];
			sb[this.name] = require(__dirname + "/" + (this.modulePath || this.name))(Module);
		}

		/**
		 * File name of the module.
		 * All sub-classes must implement this getter.
		 * @abstract
		 */
		get modulePath () {
			throw new sb.Error({ message: "get Module.modulePath is not implemented!" });
		}
	}

	const targets = [
		"query",
		"config",
		"utils",
		"cooldown-manager",
		"logger",
		"system-log",
		"vlc-connector",
		// "math-worker",
		"twitter",
	//	"database-watcher",
		"internal-request",
		"extra-news",
		"local-request",
		"runtime",
		"pastebin"
	];

	console.groupCollapsed("singletons load");
	for (const target of targets) {
		try {
			const start = process.hrtime.bigint();
			const mod = await require("./" + target)(Module);
			sb[mod.name] = await mod.singleton();
			const time = Number(process.hrtime.bigint() - start);

			console.log("Singleton module " + target + " imported as " + mod.name + " in " + Math.trunc(time / 1.0e6) + " ms");
		}
		catch (e) {
			console.log("Import of singleton module " + target + " failed", e.message, e.stack);
		}
	}
	console.groupEnd();
})();

