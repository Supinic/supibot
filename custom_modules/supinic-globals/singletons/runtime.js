/* global sb */
module.exports = (function () {
	"use strict";

	return class Runtime {
		data = {};

		#scriptHotloads = 0;
		#commandsUsed = 0;
		#rejectedCommands = 0;
		#banphraseTimeouts = {};

		static singleton () {
			if (!Runtime.module) {
				Runtime.module = new Runtime();
			}
			return Runtime.module;
		}

		/**
		 * Class containing runtime data, used by commands and some statistics.
		 * @name sb.Runtime
		 * @type Runtime()
		 */
		constructor (baseURL) {
			// keeping it blank just for now
		}

		/**
		 * Increments the used command counter by 1.
		 * Yes, that's all it does, what did you expect?
		 */
		incrementCommandsCounter () {
			this.#commandsUsed++;
		}

		/*
		 * Increments the rejected command counter by 1.
		 * Yes, that's all it does, this class is very simple, should have figured that out already.
		 */
		incrementRejectedCommands () {
			this.#rejectedCommands++;
		}

		/**
		 * Increments the banphrase timeout counter by 1.
		 * You get the point.
		 */
		incrementBanphraseTimeouts (channel) {
			if (!this.#banphraseTimeouts[channel]) {
				this.#banphraseTimeouts[channel] = 0;
			}

			this.#banphraseTimeouts[channel]++;
		}

		/**
		 * Increments the script hot-load counter by 1.
		 * Yes that's it.
		 */
		incrementScriptHotloaded () {
			this.#scriptHotloads++;
		}

		get commandsUsed () { return this.#commandsUsed; }
		get rejectedCommands () { return this.#rejectedCommands; }
		get banphraseTimeouts () { return this.#banphraseTimeouts; }
		get scriptHotloads () { return this.#scriptHotloads; }

		get modulePath () { return "runtime"; }
	};
});