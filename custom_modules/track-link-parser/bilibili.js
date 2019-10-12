module.exports = (function (TemplateParser) {
	"use strict";

	const request = require("custom-request-promise");
	const crypto = require("crypto");

	class BilibiliParser extends TemplateParser {
		#url = "http://api.bilibili.cn/view";
		#extraURL = "http://interface.bilibili.com/v2/playurl";
		#tagsURL = "https://api.bilibili.com/x/tag/archive/tags";
		#options = {};
		#urlRegex = /bilibili\.com\/video\/(av\d+(\/p\?=\d+)?)/;
		#noUrlRegex = /(av\d{8,9})/;

		/**
		 * Fetches Bilibili video data using its ID and an app key.
		 * @param {string} videoID
		 * @returns {Promise<string>}
		 */
		#fetch = (videoID) => request({
			method: "GET",
			url: `${this.#url}?id=${videoID.replace("av", "")}&appkey=${this.#options.appKey}`,
			headers: {
				"User-Agent": this.#options.userAgentDescription || "Not defined"
			}
		});

		/**
		 * Fetches extra Bilibili video data using its cid, an app key and an access token.
		 * @param {number|string} cid
		 * @returns {Promise<string>}
		 */
		#fetchExtra = (cid) => {
			const params = `appkey=${this.#options.appKey}&cid=${cid}&otype=json`;
			const hash = crypto.createHash("md5").update(params + this.#options.token).digest("hex");
			return request({
				method: "GET",
				url: this.#extraURL + "?" + params + "&sign=" + hash
			});
		};

		/**
		 * Fetches tags data for a given video.
		 * @param videoID
		 * @returns {Promise<string> | *}
		 */
		#fetchTags = (videoID) => request({
			method: "GET",
			url: `${this.#tagsURL}?aid=${videoID.replace("av", "")}`,
			headers: {
				"User-Agent": this.#options.userAgentDescription || "Not defined"
			}
		});

		constructor (options) {
			super();

			if (!options.appKey) {
				throw new Error("Bilibili parser requires options.appKey");
			}
			if (!options.token) {
				throw new Error("Bilibili parser requires options.token");
			}
			if (!options.userAgentDescription) {
				console.warn("Bilibili parser recommends using options.userAgentDescription");
			}

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
			const data = JSON.parse(await this.#fetch(videoID));
			return (data.code !== -400);
		}

		async fetchData (videoID) {
			const data = JSON.parse(await this.#fetch(videoID));
			if (data.code === "40001") {
				return {
					message: "Temporarily rate limited",
					originalMessage: "出生日期格式不正确"
				}
			}
			else if (data.code !== -400 && data.code !== -404) {
				const [extraData, tagsData] = await Promise.all([
					(async () => JSON.parse(await this.#fetchExtra(data.cid)))(),
					(async () => JSON.parse(await this.#fetchTags(videoID)))(),
				]);

				let duration = null;
				let size = null;
				if (extraData && extraData.durl && extraData.durl[0]) {
					duration = extraData.durl[0].length;
					size = extraData.durl[0].size;
				}

				return {
					type: "bilibili",
					ID: videoID,
					link: data.link,
					name: data.title,
					author: data.author,
					authorID: data.mid,
					description: data.description,
					duration: (duration) ? (duration / 1000) : null,
					created: (data.created) ? new Date(data.created * 1000) : null,
					views: data.play || null,
					comments: data.review || null,
					likes: data.video_review || null,
					thumbnail: data.pic || null,
					extra: {
						xmlCommentLink: `http://comment.bilibili.cn/${data.cid}.xml`,
						size: size,
						tags: (tagsData.data)
							? Object.values(tagsData.data).map(tag => ({
								name: tag.tag_name,
								shortDescription: tag.short_content || null,
								description: tag.content || null,
								cover: tag.cover || null,
								headCover: tag.head_cover || null,
								id: tag.tag_id,
								timesUsed: (tag.count && tag.count.use) || null
							}))
							: []
					}
				};
			}
			else {
				return null;
			}
		}
	}

	return BilibiliParser;
});