/* global sb */
module.exports = (function (Module) {
	"use strict";

	/**
	 * @todo description
	 * @name sb.LocalRequest
	 * @type LocalRequest()
	 */
	return class LocalRequest extends Module {
		/**
		 * @inheritDoc
		 * @returns {LocalRequest}
		 */
		static async singleton () {
			if (!LocalRequest.module) {
				LocalRequest.module = new LocalRequest();
			}
			return LocalRequest.module;
		}

		constructor () {
			super();

			this.playsoundCooldowns = {};
			this.url = sb.Config.get("LOCAL_IP") + ":" + sb.Config.get("LOCAL_PLAY_SOUNDS_PORT");
		}

		/**
		 * Sends a request to play a playsound locally.
		 * @param name
		 * @param system
		 * @returns {Promise<boolean|number>}
		 * Returns a number (the cooldown remaining) if the cooldown hasn't passed yet.
		 * Returns boolean, if a request was sent - true, if the sound was played; false, if there was an error.
		 */
		async playAudio (name, system = false) {
			if (!system) {
				const now = sb.Date.now();
				if (!this.playsoundCooldowns[name]) {
					this.playsoundCooldowns[name] = 0;
				}

				const playsound = (await sb.Query.getRecordset(rs => rs
					.select("Cooldown")
					.from("data", "Playsound")
					.where("Filename = %s", name)
				))[0];

				if (!playsound) {
					return false;
				}
				else if (this.playsoundCooldowns[name] > now) {
					return Math.abs(this.playsoundCooldowns[name] - now);
				}

				this.playsoundCooldowns[name] = now + playsound.Cooldown;
			}

			const result = await sb.Utils.request(this.url + "/?audio=" + name);
			return (result === "true");
		}

		async playSpecialAudio (name) {
			return await sb.Utils.request(this.url + "/?specialAudio=" + name);
		}

		async checkTextToSpeech () {
			const result = await sb.Utils.request(this.url + "/?ttsCheck=true");

			return (result === "true");
		}

		async playTextToSpeech (options) {
			const params = new sb.URLParams();
			params.set("tts", options.text);

			if (options.volume) {
				params.set("volume", options.volume);
			}
			if (options.voice) {
				params.set("voice", options.voice);
			}

			const result = await sb.Utils.request(this.url + "/?" + params.toString());
			return (result === "true");
		}

		get modulePath () { return "local-request"; }

		destroy () { }
	};
});