module.exports = (function (TemplateParser) {
	"use strict";

	const request = require("custom-request-promise");

	class SoundcloudParser extends TemplateParser {
		#url = "https://api.soundcloud.com/resolve/";
		#options = {};

		/**
		 * Fetches XML data about a video based on its ID.
		 * @param {string} videoURL
		 * @returns {Promise<string>}
		 */
		#fetch = (videoURL) => request(`${this.#url}?url=${videoURL}&client_id=${this.#options.key}`);

		constructor (options = {}) {
			super();

			if (!options.key) {
				throw new Error("Soundcloud parser: options.key is required");
			}

			this.#options = options;
		}

		parseLink (link) {
			if (link.includes("soundcloud.com/")) {
				return link;
			}
			else {
				return null;
			}
		}

		checkLink (link, noURL) {
			if (noURL) {
				throw new Error("Soundcloud parser: Cannot parse without full URL");
			}
			else {
				return link.includes("soundcloud.com/");
			}
		}

		async checkAvailable (videoURL) {
			const data = JSON.parse(await this.#fetch(videoURL));
			return !data.errors;
		}

		async fetchData (videoURL) {
			const data = JSON.parse(await this.#fetch(videoURL));

			if (data.errors) {
				return null;
			}

			return {
				type: "soundcloud",
				ID: videoURL,
				link: data.permalink_url,
				name: data.title,
				author: data.user.username,
				authorID: data.user && data.user.permalink || null,
				description: data.description || null,
				duration: data.duration / 1000,
				created: new Date(data.created_at),
				views: data.playback_count || null,
				comments: data.comment_count || null,
				likes: data.favoritings_count || null,
				thumbnail: data.artwork_url || null,
				extra: {
					apiID: data.id,
					waveform: data.waveform_url,
					monetization: data.monetization_model,
					bpm: data.bpm || null,
					genre: data.genre || null,
					reposts: data.reposts_count || null
				}
			};
		}
	}

	return SoundcloudParser;
});