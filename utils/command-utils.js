const RSSParser = require("rss-parser");
const Chrono = require("chrono-node");

const rssParser = new RSSParser();

module.exports = {
	/**
	 * Fetches time data for given GPS coordinates and timestamp
	 * @param {Object} data
	 * @param {string} data.key
	 * @param {Object} data.coordinates
	 * @param {string} data.coordinates.lng
	 * @param {string} data.coordinates.lat
	 * @param {Date|sb.Date|number} data.date = new sb.Date()
	 * @returns {Promise<{body: Object, statusCode: number}>}
	 */
	async fetchTimeData (data = {}) {
		const {
			coordinates,
			date = new sb.Date(),
			key
		} = data;

		const response = await sb.Got("Google", {
			url: "timezone/json",
			searchParams: {
				timestamp: Math.trunc(date.valueOf() / 1000),
				location: `${coordinates.lat},${coordinates.lng}`,
				key
			}
		});

		return {
			statusCode: response.statusCode,
			body: response.body
		};
	},

	/**
	 * Checks an image provided via URL for its NSFW score.
	 * @param {string} link
	 * @returns {Promise<NSFWDetectionResult>}
	 */
	async checkPictureNSFW (link) {
		const { statusCode, body: data } = await sb.Got("GenericAPI", {
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			url: "https://api.deepai.org/api/nsfw-detector",
			headers: {
				"Api-Key": sb.Config.get("API_DEEP_AI")
			},
			form: {
				image: link
			}
		});

		if (data.output?.detections) {
			for (const item of data.output.detections) {
				item.confidence = Number(item.confidence);
			}
		}

		return {
			statusCode,
			data: {
				id: data.id ?? null,
				score: data.output?.nsfw_score ?? null,
				detections: data.output?.detections ?? null
			}
		};
	},

	/**
	 * Uploads a file to {@link https://imgur.com}
	 * @param {Buffer} fileData
	 * @param {string} [linkName]
	 * @param {Object} [options]
	 * @param {string} [options.type]
	 * @returns {Promise<FileUploadResult>}
	 */
	async uploadToImgur (fileData, linkName = "random", options = {}) {
		const formData = new sb.Got.FormData();
		formData.append("image", fileData, linkName); // !!! FILE NAME MUST BE SET, OR THE API NEVER RESPONDS !!!

		const { type = "image" } = options;
		const endpoint = (type === "image")
			? "image"
			: "upload";

		const { statusCode, body } = await sb.Got("GenericAPI", {
			url: `https://api.imgur.com/3/${endpoint}`,
			responseType: "json",
			method: "POST",
			throwHttpErrors: false,
			headers: {
				...formData.getHeaders(),
				Authorization: "Client-ID c898c0bb848ca39"
			},
			body: formData.getBuffer(),
			retry: {
				limit: 0
			},
			timeout: {
				request: 10_000
			}
		});

		// Weird edge case with Imgur when uploading .webm or .mkv files will leave a "." at the end of the link
		let link = body.data?.link ?? null;
		if (typeof link === "string" && link.endsWith(".")) {
			link = `${link}mp4`;
		}

		return {
			statusCode,
			link
		};
	},

	/**
	 * Uploads a file to {@link https://i.nuuls.com}
	 * @param {Buffer} fileData
	 * @param {string} [fileName] custom filename, used for managing extensions
	 * @returns {Promise<FileUploadResult>}
	 */
	async uploadToNuuls (fileData, fileName = "file.jpg") {
		const form = new sb.Got.FormData();
		form.append("attachment", fileData, fileName);

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: "https://i.nuuls.com/upload",
			responseType: "text",
			headers: {
				...form.getHeaders()
			},
			body: form.getBuffer(),
			retry: {
				limit: 0
			},
			timeout: {
				request: 10_000
			}
		});

		return {
			statusCode: response.statusCode,
			link: response.body ?? null
		};
	},

	/**
	 * Parses an RSS string into JS object format.
	 * @param {string} xml
	 * @returns {Promise<RSSParserResult>}
	 */
	async parseRSS (xml) {
		return await rssParser.parseString(xml);
	},

	/**
	 * Returns the URL's pathname + search params, if defined.
	 * Returns null if it is in any way invalid.
	 * @param {string} stringURL
	 * @returns {null|string}
	 */
	getPathFromURL (stringURL) {
		if (!stringURL) {
			return null;
		}

		const { URL } = require("url");
		let url;
		try {
			url = new URL(stringURL);
		}
		catch {
			return null;
		}

		const path = (url.pathname ?? "").replace(/^\//, "");
		return `${path}${url.search}`;
	},

	/**
	 * @param {string} string
	 * @param {Date} referenceDate
	 * @param {Object} options
	 */
	parseChrono (string, referenceDate = null, options = {}) {
		const chronoData = Chrono.parse(string, referenceDate, options);
		if (chronoData.length === 0) {
			return null;
		}

		const [chrono] = chronoData;
		return {
			date: chrono.start.date(),
			component: chrono.start,
			text: chrono.text
		};
	},

	/**
	 * Returns Google Geo Data for given query
	 * @param {string} key Google Geo API key
	 * @param {string} query
	 * @returns {Promise<Object>}
	 */
	async fetchGeoLocationData (key, query) {
		const { results, status } = await sb.Got("GenericAPI", {
			url: "https://maps.googleapis.com/maps/api/geocode/json",
			searchParams: {
				key,
				address: query
			}
		}).json();

		if (status !== "OK") {
			return {
				success: false,
				cause: status
			};
		}

		const {
			address_components: components,
			formatted_address: formatted,
			place_id: placeID,
			geometry: { location }
		} = results[0];

		const object = {};
		for (const row of components) {
			let { types, long_name: long } = row;
			if (types.includes("political")) {
				types = types.filter(i => i !== "political");
				types[0] = types[0].replace(/_/g, "").replace("administrativearea", "");
				object[types[0]] = long;
			}
		}

		return {
			success: true,
			components: object,
			placeID,
			location,
			formatted
		};
	},

	/**
	 * Fetches info about a provided Youtube video.
	 * @param {string} query Search string
	 * @param {string} key Youtube API key
	 * @param {object} options = {} additional options
	 * @param {number} [options.maxResults]
	 * @param {boolean} [options.single]
	 * @returns {Promise<string>}
	 */
	async searchYoutube (query, key, options = {}) {
		const params = { ...options };
		if (params.single) {
			if (typeof params.maxResults !== "undefined") {
				throw new sb.Error({
					message: "Cannot combine params maxResults and single"
				});
			}

			params.maxResults = 1;
		}

		const { items } = await sb.Got("GenericAPI", {
			url: `https://www.googleapis.com/youtube/v3/search`,
			searchParams: {
				key,
				q: query,
				type: "video",
				part: "snippet",
				maxResults: params.maxResults ?? "10",
				sort: "relevance"
			}
		}).json();

		const videoList = items
			// This filtering shouldn't be necessary, but in some cases YouTube API returns playlists
			// despite the `type` parameter being set to strictly return videos only.
			.filter(i => i.id.kind === "youtube#video" && i.id.videoId)
			.map(i => ({
				ID: i.id.videoId,
				title: i.snippet.title
			}));

		return (params.single)
			? videoList[0] ?? null
			: videoList;
	},

	/**
	 * Fetches a Youtube playlist as an array of video IDs.
	 * Optionally, limits the amount of videos fetched.
	 * @param {Object} options
	 * @params {string} options.key Google/Youtube API key
	 * @params {string} options.playlistID Youtube playlist ID
	 * @params {number} [options.perPage = 50] How many videos should be fetched per page.
	 * @params {number} [options.limit] Limit the number of videos.
	 * @params {string} [options.limitAction]
	 * @returns {Promise<string[]>}
	 */
	async fetchYoutubePlaylist (options = {}) {
		if (!options.key) {
			throw new sb.Error({
				message: "No API key provided"
			});
		}
		else if (!options.playlistID) {
			throw new sb.Error({
				message: "No playlist ID provided"
			});
		}

		const limit = options.limit ?? Infinity;
		const baseParams = {
			part: "snippet",
			key: options.key,
			maxResults: options.perPage ?? 50,
			playlistId: options.playlistID
		};

		let pageToken = null;
		const result = [];
		do {
			const searchParams = { ...baseParams };
			if (pageToken) {
				searchParams.pageToken = pageToken;
			}

			const { body: data, statusCode } = await sb.Got("GenericAPI", {
				url: "https://www.googleapis.com/youtube/v3/playlistItems",
				searchParams,
				throwHttpErrors: false,
				responseType: "json"
			});

			if (statusCode !== 200) {
				return {
					success: false,
					reason: "not-found"
				};
			}

			pageToken = data.nextPageToken;
			result.push(...data.items.map(i => ({
				ID: i.snippet.resourceId.videoId,
				title: i.snippet.title,
				channelTitle: i.snippet.channelTitle,
				published: new sb.Date(i.snippet.publishedAt),
				position: i.snippet.position
			})));

			if (options.limitAction === "trim" && result.length > limit) {
				return result.slice(0, limit);
			}
			else if (data.pageInfo.totalResults > limit) {
				if (options.limitAction === "error") {
					throw new sb.Error({
						message: "Maximum amount of videos exceeded!",
						args: {
							limit,
							amount: data.pageInfo.totalResults
						}
					});
				}
				else if (options.limitAction === "return") {
					return {
						success: false,
						reason: "limit-exceeded",
						limit,
						amount: data.pageInfo.totalResults
					};
				}
				else {
					return {
						success: true,
						reason: "limit-exceeded",
						amount: data.pageInfo.totalResults,
						result,
						limit
					};
				}
			}
		} while (pageToken);

		return {
			success: true,
			result
		};
	}
};

/**
 * @typedef {Object} NSFWDetectionResult
 * @property {number} statusCode
 * @property {Object} data
 * @property {string} data.id
 * @property {number} data.score
 * @property {NSFWDetectionItem[]} data.detections
 */

/**
 * @typedef {Object} NSFWDetectionItem
 * @property {number[]} bounding_box Array of four numbers determining the bounding box coordinates
 * @property {number} confidence
 * @property {string} name
 */

/**
 * @typedef {Object} FileUploadResult
 * @property {number} statusCode
 * @property {string} link
 */

/**
 * @typedef {Object} RSSParserResult
 * @property {string} description
 * @property {Object} image
 * @property {string} image.link
 * @property {string} image.title
 * @property {string} image.url
 * @property {RSSArticle[]} items
 * @property {string} language
 * @property {string} link
 * @property {string} title
 */

/**
 * @typedef {Object} RSSArticle
 * @property {string} author
 * @property {string[]} categories
 * @property {string} content
 * @property {string} contentSnippet
 * @property {string} creator
 * @property {string} isoDate
 * @property {string} link
 * @property {string} pubDate
 * @property {string} title
 */
