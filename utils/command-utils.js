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
	 * @deprecated DeepAI API is no longer available, since 2023-12-15 07:34:42+00:00
	 * @todo find a replacement API with similar provided data
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
	 * @param {boolean} [options.checkCommandBlocks]
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
			if (options.checkCommandBlocks && !commandData.Flags.block) {
				return {
					success: false,
					reply: `You cannot block users from this command!`
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
		const {
			filter,
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

			const filter = await sb.Filter.create({
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
