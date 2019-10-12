module.exports = (function (TemplateParser) {
	"use strict";

	const request = require("custom-request-promise");
	const xmlParser = require("fast-xml-parser");

	class NicovideoParser extends TemplateParser {
		#url = "https://ext.nicovideo.jp/api/getthumbinfo/";
		#options = {};
		#urlRegex = /nicovideo\.jp\/watch\/([s|n]m\d+)/;
		#noUrlRegex = /(s|nm\d{7,9})/;

		/**
		 * Fetches XML data about a video based on its ID.
		 * @param {string} videoID
		 * @returns {Promise<string>}
		 */
		#fetch = (videoID) => request(this.#url + videoID);

		constructor (options) {
			super();
			this.#options = options;
		}

		parseLink (link) {
			const match = link.match(this.#urlRegex);
			return match ? match[1] : null;
		}

		checkLink (link, noURL) {
			if (noURL) {
				return this.#noUrlRegex.test(link);
			}
			else {
				return this.#urlRegex.test(link);
			}
		}

		async checkAvailable (videoID) {
			const xmlData = await this.#fetch(videoID);
			const data = xmlParser.parse(xmlData).nicovideo_thumb_response;

			return !data.error;
		}

		async fetchData (videoID) {
			const xmlData = await this.#fetch(videoID);
			const rawData = xmlParser.parse(xmlData).nicovideo_thumb_response;

			if (rawData.error) {
				return null;
			}

			const data = rawData.thumb;
			return {
				type: "nicovideo",
				ID: data.video_id,
				link: "https://www.nicovideo.jp/watch/" + data.video_id,
				name: data.title,
				author: data.user_nickname || null,
				authorID: data.user_id,
				description: data.description,
				duration: data.length.split(":").map(Number).reduce((acc, cur, ind) => (ind === 0) ? acc += cur * 60 : acc += cur, 0),
				created: new Date(data.first_retrieve),
				views: data.view_counter || null,
				comments: data.comment_num || null,
				likes: data.mylist_counter || null,
				thumbnail: data.thumbnail_url || null,
				extra: {
					tags: (data.tags) ? data.tags.tag :[]
				}
			};
		}
	}

	return NicovideoParser;
});