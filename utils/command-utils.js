const { randomInt } = require("node:crypto");
const { Blob } = require("node:buffer");

const RSSParser = require("rss-parser");
const Chrono = require("chrono-node");

const rssParser = new RSSParser();
const MAX_SAFE_RANGE = 281474976710655;
const VIDEO_TYPE_REPLACE_PREFIX = "$";

const PASTEBIN_EXPIRATION_OPTIONS = {
	never: "N",
	"10 minutes": "10M",
	"1 hour": "1H",
	"1 day": "1D",
	"1 week": "1W",
	"2 weeks": "2W",
	"1 month": "1M",
	"6 months": "6M",
	"1 year": "1Y"
};
const PASTEBIN_PRIVACY_OPTIONS = {
	public: 0,
	unlisted: 1,
	private: 2
};

module.exports = {
	randomInt (min, max) {
		if (Math.abs(min) >= Number.MAX_SAFE_INTEGER || Math.abs(max) >= Number.MAX_SAFE_INTEGER) {
			throw new sb.Error({
				message: "Integer range exceeded",
				args: { min, max }
			});
		}

		const range = max - min;
		if (range <= MAX_SAFE_RANGE) {
			return randomInt(min, max + 1);
		}

		const baseRoll = randomInt(0, MAX_SAFE_RANGE);
		const multiplier = range / MAX_SAFE_RANGE;
		const roll = Math.trunc(baseRoll * multiplier);

		return (min + roll);
	},

	/**
	 * Fetches time data for given GPS coordinates and timestamp
	 * @param {Object} data
	 * @param {Object} data.coordinates
	 * @param {string} data.coordinates.lng
	 * @param {string} data.coordinates.lat
	 * @param {Date|sb.Date|number} data.date = new sb.Date()
	 * @returns {Promise<{body: Object, statusCode: number}>}
	 */
	async fetchTimeData (data = {}) {
		if (!process.env.API_GOOGLE_TIMEZONE) {
			throw new sb.Error({
				message: "No Google timezone API key configured (API_GOOGLE_TIMEZONE)"
			});
		}

		const {
			coordinates,
			date = new sb.Date()
		} = data;

		const response = await sb.Got("Google", {
			url: "timezone/json",
			searchParams: {
				timestamp: Math.trunc(date.valueOf() / 1000),
				location: `${coordinates.lat},${coordinates.lng}`,
				key: process.env.API_GOOGLE_TIMEZONE
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
	 * @deprecated DeepAI API is no longer available, since 2023-12-15 07:34:42+00:00
	 * @todo find a replacement API with similar provided data
	 */
	async checkPictureNSFW (link) {
		if (!process.env.API_DEEP_AI) {
			throw new sb.Error({
				message: "No DeepAI key configured (API_DEEP_AI)"
			});
		}

		const { statusCode, body: data } = await sb.Got("GenericAPI", {
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			url: "https://api.deepai.org/api/nsfw-detector",
			headers: {
				"Api-Key": process.env.API_DEEP_AI
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
	 * @param {Object} [options]
	 * @param {string} [options.type]
	 * @returns {Promise<FileUploadResult>}
	 */
	async uploadToImgur (fileData, options = {}) {
		const { type = "image" } = options;
		const endpoint = (type === "image") ? "image" : "upload";
		const filename = (type === "image") ? "image.jpg" : "video.mp4";

		// !!! FILE NAME MUST BE SET, OR THE API NEVER RESPONDS !!!
		const formData = new FormData();
		formData.append("image", new Blob([fileData]), filename);
		formData.append("type", "image");
		formData.append("title", "Simple upload");

		const { statusCode, body } = await sb.Got("GenericAPI", {
			url: `https://api.imgur.com/3/${endpoint}`,
			responseType: "json",
			method: "POST",
			throwHttpErrors: false,
			headers: {
				Authorization: "Client-ID c898c0bb848ca39"
			},
			body: formData,
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
	 * @returns {Promise<FileUploadResult>}
	 */
	async uploadToNuuls (fileData) {
		const formData = new FormData();
		formData.append("attachment", fileData);

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: "https://i.nuuls.com/upload",
			responseType: "text",
			body: formData,
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

		const { URL } = require("node:url");
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
	 * @param {string} query
	 * @returns {Promise<Object>}
	 */
	async fetchGeoLocationData (query) {
		if (!process.env.API_GOOGLE_GEOCODING) {
			throw new sb.Error({
				message: "No Google geolocation API key configured (API_GOOGLE_GEOCODING)"
			});
		}

		const { results, status } = await sb.Got("GenericAPI", {
			url: "https://maps.googleapis.com/maps/api/geocode/json",
			searchParams: {
				key: process.env.API_GOOGLE_GEOCODING,
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
	 * Fetches info about a provided YouTube video.
	 * @param {string} query Search string
	 * @param {object} options = {} additional options
	 * @param {number} [options.maxResults]
	 * @param {boolean} [options.single]
	 * @returns {Promise<string>}
	 */
	async searchYoutube (query, options = {}) {
		if (!process.env.API_GOOGLE_YOUTUBE) {
			throw new sb.Error({
				message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
			});
		}

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
				key: process.env.API_GOOGLE_YOUTUBE,
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
	 * Fetches a YouTube playlist as an array of video IDs.
	 * Optionally, limits the amount of videos fetched.
	 * @param {Object} options
	 * @params {string} options.playlistID YouTube playlist ID
	 * @params {number} [options.perPage = 50] How many videos should be fetched per page.
	 * @params {number} [options.limit] Limit the number of videos.
	 * @params {string} [options.limitAction]
	 * @returns {Promise<string[]>}
	 */
	async fetchYoutubePlaylist (options = {}) {
		if (!process.env.API_GOOGLE_YOUTUBE) {
			throw new sb.Error({
				message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
			});
		}

		if (!options.playlistID) {
			throw new sb.Error({
				message: "No playlist ID provided"
			});
		}

		const limit = options.limit ?? Infinity;
		const baseParams = {
			part: "snippet",
			key: process.env.API_GOOGLE_YOUTUBE,
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
	},

	/**
	 * Returns the Twitch game ID for the given game name.
	 * @param {string} name The name of the game to get the ID for.
	 * @return {Promise<Array<{id: string, name: string}>>}
	 */
	async getTwitchGameID (name) {
		const response = await sb.Got("Helix", {
			url: "games",
			searchParams: { name }
		});

		if (!response.ok || response.body.data.length === 0) {
			return [];
		}

		return response.body.data.map(i => ({
			id: i.id,
			name: i.name
		}));
	},

	/**
	 * Standard parser function for all Filter-related commands.
	 * Grabs platform. channel, command (additionally user too) from the context.params object
	 * and also returns parse failures if encountered.
	 * @param {string} type
	 * @param {Object} params
	 * @param {string[]} args
	 * @param {Object} options
	 * @param {string[]} options.argsOrder
	 * @param {boolean} [options.includeUser]
	 * @param {string} [options.requiredCommandFlag]
	 * @param {string} [options.requiredCommandFlagResponse]
	 * @return {Promise<{filterData: Object, success: true}|{filter: Filter, success: true}|{success: false, reply: string}>}
	 */
	async parseGenericFilterOptions (type, params, args, options = {}) {
		if (params.id) {
			const filter = sb.Filter.get(params.id);
			if (!filter) {
				return {
					success: false,
					reply: `There is no filter with ID ${params.id}!`
				};
			}
			else if (filter.Type !== type) {
				return {
					success: false,
					reply: `Invalid filter type provided! Re-check the filter ID.`
				};
			}

			return {
				success: true,
				filter
			};
		}

		const filterData = {
			command: null,
			channel: null,
			platform: null,
			invocation: null
		};

		const commandArgId = options.argsOrder.indexOf("command");
		const commandName = params.command ?? args[commandArgId];

		if (!commandName) {
			return {
				success: false,
				reply: `A command (or "all" to optout globally) must be provided!`
			};
		}

		if (commandName === "all") {
			filterData.command = null;
		}
		else {
			const commandData = sb.Command.get(commandName);
			if (!commandData) {
				return {
					success: false,
					reply: `Command ${commandName} does not exist!`
				};
			}
			if (options.requiredCommandFlag && !commandData.Flags[options.requiredCommandFlag]) {
				return {
					success: false,
					reply: options.requiredCommandFlagResponse
				};
			}

			filterData.command = commandData.Name;

			// Apply a "heuristic" - if user provided an alias to a command, automatically assume
			// it's the base command + the alias as invocation
			if (commandData.Name !== commandName) {
				filterData.invocation = commandName;
			}
		}

		if (params.channel && params.platform) {
			return {
				success: false,
				reply: "Cannot specify both the channel and platform!"
			};
		}

		if (params.channel) {
			const channelData = sb.Channel.get(params.channel);
			if (!channelData) {
				return {
					success: false,
					reply: `Channel ${params.channel} does not exist!`
				};
			}

			filterData.channel = channelData.ID;
		}

		if (params.platform) {
			const platformData = sb.Platform.get(params.platform);
			if (!platformData) {
				return {
					success: false,
					reply: `Platform ${params.platform} does not exist!`
				};
			}

			filterData.platform = platformData.ID;
		}

		if (options.includeUser) {
			filterData.user = null;

			const userArgId = options.argsOrder.indexOf("user");
			const userName = params.user ?? args[userArgId];

			if (userName) {
				const userData = await sb.User.get(userName);
				if (!userData) {
					return {
						success: false,
						reply: `User ${userName} does not exist!`
					};
				}

				filterData.user = userData.ID;
			}
		}

		return {
			success: true,
			filterData
		};
	},

	/**
	 * @param {string} type
	 * @param {Object} data
	 * @param {Filter | null} data.filter
	 * @param {string} data.enableInvocation
	 * @param {string} data.disableInvocation
	 * @param {string} data.enableVerb
	 * @param {string} data.disableVerb
	 * @param {Command.Context} data.context
	 * @param {Object} data.filterData
	 * @return {Promise<{reply: string, success?: boolean}>}
	 */
	async handleGenericFilter (type, data) {
		let { filter } = data;
		const {
			enableInvocation,
			disableInvocation,
			enableVerb,
			disableVerb,
			context,
			filterData
		} = data;

		let replyFn;
		const { invocation, params } = context;
		const verb = (invocation === enableInvocation) ? enableVerb : disableVerb;

		if (filter) {
			if (filter.Issued_By !== context.user.ID) {
				return {
					success: false,
					reply: `You can't edit this filter - you didn't create it!`
				};
			}

			if ((filter.Active && invocation === enableInvocation) || (!filter.Active && invocation === disableInvocation)) {
				const state = (invocation === enableInvocation) ? "enabled" : "disabled";
				return {
					success: false,
					reply: (params.id)
						? `Your filter ID ${params.id} is already ${state}!`
						: `This combination is already ${state}!`
				};
			}

			await filter.toggle();

			replyFn = (commandString) => `Successfully ${verb} ${commandString} (ID ${filter.ID}).`;
		}
		else {
			if (invocation === disableInvocation) {
				return {
					success: false,
					reply: `You have not ${enableVerb} this combination before, so you can't ${invocation} just yet!`
				};
			}

			filter = await sb.Filter.create({
				Active: true,
				Type: type,
				User_Alias: context.user.ID,
				Issued_By: context.user.ID,
				Command: filterData.command,
				Channel: filterData.channel,
				Platform: filterData.platform,
				Invocation: filterData.invocation,
				Blocked_User: filterData.user ?? null
			});

			let location = "";
			if (context.params.channel) {
				location = ` in channel ${params.channel}`;
			}
			else if (params.platform) {
				location = ` in platform ${params.platform}`;
			}

			replyFn = (commandString) => `Successfully ${verb} ${commandString} ${location} (ID ${filter.ID}).`;
		}

		let commandString;
		const prefix = sb.Command.prefix;
		if (filter.Command === null) {
			commandString = `all valid commands`;
		}
		else if (filter.Invocation !== null) {
			commandString = `command ${prefix}${filter.Command} (alias ${prefix}${filter.Invocation})`;
		}
		else {
			commandString = `command ${prefix}${filter.Command}`;
		}

		const reply = replyFn(commandString);
		return {
			reply
		};
	},

	/**
	 * Posts the provided text to Pastebin, creating a new "paste".
	 * @param {string} text
	 * @param {Object} [options]
	 * @param {string} [options.name] Paste title
	 * @param {"public"|"unlisted"|"private"} [options.privacy] Paste privacy setting
	 * @param {"N"|"10M"|"1H"|"1D"|"1W"|"2W"|"1M"|"6M"|"1Y"} [options.expiration] Paste expiration interval
	 * @param {string} [options.format] Paste format, programming language
	 * @returns {Promise<{ok: boolean, body: string | null, statusCode: number | null, reason: string | null}>}
	 */
	async postToPastebin (text, options = {}) {
		if (!process.env.API_PASTEBIN) {
			return {
				ok: false,
				statusCode: null,
				body: null,
				reason: "Cannot upload to Pastebin - missing env variable API_PASTEBIN"
			};
		}

		const params = new URLSearchParams({
			api_dev_key: process.env.API_PASTEBIN,
			api_option: "paste",
			api_paste_code: text,
			api_paste_name: options.name || "untitled Supibot paste",
			api_paste_private: (options.privacy) ? PASTEBIN_PRIVACY_OPTIONS[options.privacy] : "1",
			api_paste_expire_date: (options.expiration) ? PASTEBIN_EXPIRATION_OPTIONS[options.expiration] : "10M"
		});

		if (options.format) {
			params.append("api_paste_format", options.format);
		}

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: "https://pastebin.com/api/api_post.php",
			throwHttpErrors: false,
			responseType: "text",
			body: params.toString(),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			timeout: {
				request: 5000
			}
		});

		const result = {
			ok: response.ok,
			statusCode: response.statusCode,
			body: response.body,
			reason: null
		};

		if (!response.ok) {
			result.reason = (response.statusCode === 422)
				? "Your paste got rejected by Pastebin's SMART filters!"
				: "Could not create a Pastebin paste!";
		}

		return result;
	},

	VIDEO_TYPE_REPLACE_PREFIX
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
