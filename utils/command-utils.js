const { spawn } = require("child_process");

module.exports = {
	/**
	 * Fetches time data for given GPS coordinates and timestamp
	 * @param {Object} data
	 * @param {string} data.key
	 * @param {Object} data.coordinates
	 * @param {string} data.coordinates.lng
	 * @param {string} data.coordinates.lat
	 * @param {Date|sb.Date|number} data.date = new SupiDate()
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
	 * Splits a given string into a given amount of "messages", where each contains up to `limit` characters.
	 * Only splits on entire words
	 * @param {string} message
	 * @param {number} limit
	 * @param {number} messageCount
	 * @returns {[]}
	 */
	partitionString (message, limit, messageCount) {
		if (!this.isValidInteger(limit)) {
			throw new sb.Error({
				message: "Limit must be a positive integer"
			});
		}

		const words = [];
		const regex = new RegExp(`.{1,${limit}}`, "g");
		for (const rawWord of message.split(" ")) {
			if (rawWord.length > limit) {
				words.push(...rawWord.match(regex));
			}
			else {
				words.push(rawWord);
			}
		}

		const result = [];
		let buffer = [];
		let counter = 0;
		let messages = 1;
		let loopBroken = false;

		for (const word of words) {
			buffer.push(word);
			counter += word.length + 1;

			if (counter >= limit) {
				counter = 0;

				buffer.pop();
				result.push(buffer.join(" "));
				buffer = [word];
				messages++;
			}

			if (messages > messageCount) {
				loopBroken = true;
				break;
			}
		}

		if (!loopBroken) {
			result.push(buffer.join(" "));
		}

		return result;
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
