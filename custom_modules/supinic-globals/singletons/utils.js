/* global sb */
module.exports = (function (Module) {
	"use strict";

	const RandomJS = require("random-js");
	const requestPromise = require("custom-request-promise");
	const { parse: urlParser } = require("url");

	return class Utils extends Module {
		#linkParser = null;

		get linkParser () {
			if (!this.#linkParser) {
				const LinkParserFactory = require("track-link-parser");
				this.#linkParser = new LinkParserFactory({
					youtube: {
						key: sb.Config.get("API_GOOGLE_YOUTUBE")
					},
					bilibili: {
						appKey: sb.Config.get("BILIBILI_APP_KEY"),
						token: sb.Config.get("BILIBILI_PRIVATE_TOKEN"),
						userAgentDescription: sb.Config.get("BILIBILI_USER_AGENT")
					},
					soundcloud: {
						key: sb.Config.get("SOUNDCLOUD_CLIENT_ID")
					}
				});
			}

			return this.#linkParser;
		}

		/** @inheritDoc */
		static singleton() {
			if (!Utils.module) {
				Utils.module = new Utils();
			}
			return Utils.module;
		}

		/**
		 * Returns onversion numbers between two time units.
		 * @returns {Object}
		 */
		static get timeUnits () {
			return {
				y: {d: 365, h: 8760, m: 525600, s: 31536000, ms: 31536000.0e3},
				d: {h: 24, m: 1440, s: 86400, ms: 86400.0e3},
				h: {m: 60, s: 3600, ms: 3600.0e3},
				m: {s: 60, ms: 60.0e3},
				s: {ms: 1.0e3}
			};
		}

		/**
		 * Class containing various utility methods that don't fit elsewhere.
		 * @name sb.Utils
		 * @type Utils()
		 */
		constructor () {
			super();

			this.Cheerio  = null;
			this.Transliterate = null;

			this.YoutubeUtils = require("youtube-utils");
			this.duration = new (require("duration-parser"))();
			this.ytdl = require("youtube-dl");
			this.fs = require("fs");

			this.languageISO = require("language-iso-codes");

			//this.nativeRandom = new Random();
			this.mersenneRandom = new RandomJS.Random(RandomJS.MersenneTwister19937.autoSeed());

			this.htmlEntities = {
				"nbsp": " ",
				"lt": "<",
				"gt": ">",
				"amp": "&",
				"quot": "\"",
				"apos": "'",
				"cent": "¢",
				"pound": "£",
				"yen": "¥",
				"euro": "€",
				"copy": "©",
				"reg": "®",
			};
		}

		/**
		 * Promisified request
		 * @param {...*} args
		 * @returns {Promise<string>}
		 */
		async request(...args) {
			return await requestPromise(...args);
		}

		/**
		 * Capitalizes the string's first letter.
		 * @param {string} string
		 * @returns {string}
		 */
		capitalize (string) {
			return string[0].toUpperCase() + string.substring(1).toLowerCase();
		}

		/**
		 * Returns a formatted string, specifying an amount of time delta from current date to provided date.
		 * @param {sb.Date|Date} target
		 * @param {boolean} [skipAffixes] if true, the affixes "in X hours" or "X hours ago" will be omitted
		 * @returns {string}
		 */
		timeDelta (target, skipAffixes = false) {
			const now = new sb.Date();
			if (sb.Date.equals(now, target)) {
				return "right now!";
			}

			let string = "";
			const delta = Math.abs(now.valueOf() - target.valueOf());
			const [prefix, suffix] = (target > now) ? ["in ", ""] : ["", " ago"];

			if (delta < Utils.timeUnits.s.ms) {
				string = delta + "ms";
			}
			else if (delta < Utils.timeUnits.m.ms) {
				string = this.round(delta / Utils.timeUnits.s.ms, 2) + "s";
			}
			else if (delta < Utils.timeUnits.h.ms) {
				const minutes = Math.trunc(delta / Utils.timeUnits.m.ms);
				const seconds = Math.trunc((delta / Utils.timeUnits.s.ms ) % Utils.timeUnits.m.s);
				string = minutes + "m, " + seconds + "s";
			}
			else if (delta < Utils.timeUnits.d.ms) {
				const hours = Math.trunc(delta / Utils.timeUnits.h.ms);
				const minutes = Math.trunc(delta / Utils.timeUnits.m.ms) % Utils.timeUnits.h.m;
				string = hours + "h, " + minutes + "m";
			}
			else if (delta < Utils.timeUnits.y.ms) {
				const days = Math.trunc(delta / Utils.timeUnits.d.ms);
				const hours = Math.trunc(delta / Utils.timeUnits.h.ms) % Utils.timeUnits.d.h;
				string = days + "d, " + hours + "h";
			}
			else {
				const years = Math.trunc(delta / Utils.timeUnits.y.ms);
				const days = Math.trunc(delta / Utils.timeUnits.d.ms) % Utils.timeUnits.y.d;
				string = years + "y, " + days + "d";
			}

			return (skipAffixes)
				? string
				: (prefix + string + suffix);
		}

		/**
		 * Transforms a string into a dictionary-like Map to count how many times a word has been used in the message
		 * @param {string} message
		 * @param {"asc"|"desc"} [orderBy] Direction to order the result Map by
		 * @returns {Map<string, number>} The amount of times a word has been used in the message
		 */
		toDictionary(message, orderBy = "asc") {
			const arr = message.replace(/\s+/g, " ").trim().split(" ");
			let dictionary = new Map(arr.map(i => [i, 0]));
			arr.forEach(i => dictionary.set(i, dictionary.get(i) + 1));

			if (orderBy.toLowerCase() === "desc") {
				dictionary = new Map([...dictionary.entries()].sort((a, b) => b[1] - a[1]));
			}
			else if (orderBy.toLowerCase() === "asc") {
				dictionary = new Map([...dictionary.entries()].sort((a, b) => a[1] - b[1]));
			}

			return dictionary;
		}

		/**
		 * Rounds a number to given amount of decimal places.
		 * @param {number} number
		 * @param {number} [places]
		 * @returns {number}
		 */
		round(number, places = 0) {
			return (Math.round(number * (10 ** places))) / (10 ** places);
		}

		/**
		 * @todo Finish documentation
		 * @param {string} string
		 * @returns {string}
		 */
		fixHTML (string) {
			return string.replace(/&#?(?<identifier>[a-z0-9]+);/g, (...params) => {
				const {identifier} = params.pop();
				return this.htmlEntities[identifier] || String.fromCharCode(Number(identifier));
			});
		}

		/**
		 * Removes all HTML-like tags from input string.
		 * @param string
		 * @returns {string}
		 */
		removeHTML(string) {
			return string.replace(/<(.*?)>/g, "");
		}

		/**
		 * Wraps the input string into the given amount of characters, discarding the rest.
		 * @param {string} string
		 * @param {number} length
		 * @returns {string}
		 */
		wrapString (string, length) {
			string = string.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
			return (string.length >= length)
				? (string.slice(0, length - 3) + "...")
				: string;
		}

		/**
		 * Returns a random integer between min and max, inclusively.
		 * @param {number} min
		 * @param {number} max
		 * @returns {number}
		 */
		random (min, max) {
			return this.mersenneRandom.integer(min, max);
		}

		/**
		 * Returns a random array element.
		 * @param {Array} arr
		 * @returns {*}
		 */
		randArray(arr) {
			return (arr.length === 0)
				? undefined
				: arr[this.random(0, arr.length - 1)];
		}

		/**
		 * Formats a number specifying the amount of seconds to a string.
		 * @param {number} seconds
		 * @param {boolean} [videoStyle] If false, format will be HH:MM:SS - if true, format will be HH hr, MM min, SS sec
		 * @returns {string}
		 */
		formatTime (seconds = 0, videoStyle = false) {
			seconds = Number(seconds);
			let stuff = [];

			if (videoStyle) {
				if (seconds >= Utils.timeUnits.h.s) {
					const hr = Math.floor(seconds / Utils.timeUnits.h.s);
					stuff.push(hr);
					seconds -= (hr * Utils.timeUnits.h.s);
				}
				const min = Math.floor(seconds / Utils.timeUnits.m.s);
				stuff.push(min);
				seconds -= (min * Utils.timeUnits.m.s);
				stuff.push(this.zf(seconds, 2));

				return stuff.join(":");
			}
			else {
				if (seconds >= Utils.timeUnits.h.s) {
					const hr = Math.floor(seconds / Utils.timeUnits.h.s);
					stuff.push(hr + " hr");
					seconds -= (hr * Utils.timeUnits.h.s);
				}
				if (seconds >= Utils.timeUnits.m.s) {
					const min = Math.floor(seconds / Utils.timeUnits.m.s);
					stuff.push(min + " min");
					seconds -= (min * Utils.timeUnits.m.s);
				}
				if (seconds >= 0 || stuff.length === 0) {
					stuff.push(seconds + " sec");
				}
				return stuff.join(", ");
			}
		}

		/**
		 * Turns an array of string arguments to a character-separated string.
		 * Usually used for URL requests.
		 * @param {string[]} array
		 * @param {string} [character]
		 * @returns {string}
		 */
		argsToFixedURL(array, character = "+") {
			return array.map(i => encodeURIComponent(i)).join(character);
		}

		/**
		 * Removes all (central European?) accents from a string.
		 * @param {string} string
		 * @returns {string}
		 */
		removeAccents(string) {
			return string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		}

		/**
		 * Fetches info about a provided Youtube video.
		 * @param {string} videoString String containing a link to a Youtube video.
		 * @param {string} key Youtube API key.
		 * @returns {Promise<YoutubeDataObject>}
		 */
		async fetchYoutubeVideo (videoString, key) {
			return await this.YoutubeUtils.fullFetch(key, videoString);
		}

		/**
		 * Pads a number with specified number of zeroes.
		 * @param {number} number
		 * @param {number} padding
		 * @returns {string}
		 */
		zf(number, padding) {
			return ("0".repeat(padding) + number).slice(-padding);
		}

		/**
		 * Returns string with the english ordinal assigned to it.
		 * @param {number} number
		 * @returns {string}
		 */
		formatEnglishOrdinal(number) {
			number = Number(number);
			switch (number) {
				case 1:
					return "1st";
				case 2:
					return "2nd";
				case 3:
					return "3rd";
				default:
					return "th";
			}
		}

		/**
		 * Returns Google Geo Data for given query
		 * @param {string} query
		 * @param {string} key Google Geo API key
		 * @returns {Promise<Object>}
		 */
		async fetchGeoLocationData(query, key) {
			const url = `https://maps.googleapis.com/maps/api/geocode/json?key=${key}&address=${query}`;
			return JSON.parse(await requestPromise(url));
		}

		/**
		 * Parses strings containing time units into a time number.
		 * @param {string} string A string containing potential data about a duration.
		 * @param {TimeUnit} unit
		 * @returns {number}
		 */
		parseDuration(string, unit) {
			return this.duration.parse(string, unit);
		}

		getVideoInfo (link) {
			return new Promise((resolve, reject) => {
				const options = ["--age-limit=18"];
				this.ytdl.getInfo(link, options, (err, resp) => {
					if (err) {
						reject(err);
					}
					else {
						resolve(resp);
					}
				});
			});
		}

		/**
		 * Checks if the string user is contained within the Discord mentions.
		 * If it is, tries to return a User with the corresponding Discord ID.
		 * Otherwise returns null.
		 * @param {string} stringUser The user name to check
		 * @param {Object} options Discord options object
		 * @returns {Promise<null|User>}
		 */
		async getDiscordUserDataFromMentions (stringUser, options) {
			let result = null;

			if (options && options.mentions) {
				stringUser = stringUser.replace(/^@/, "");

				if (options.mentions.users.size === 0) {
					return null;
				}

				// Take the first mention
				const mention =  options.mentions.users.entries().next().value[1];

				// Now, check if the mention at least contains the username we're trying to find.
				if (mention.username.toLowerCase().includes(stringUser)) {
					result = await sb.User.getByProperty("Discord_ID", mention.id);
				}
			}

			return result;
		}

		downloadVideoFile (link, path) {
			return new Promise((resolve, reject) => {
				const stream = this.ytdl(link);

				stream.on("error", (err) => reject(err));
				stream.on("end", () => resolve());
				stream.pipe(this.fs.createWriteStream(path));
			});
		}

		convertCase (text, caseFrom, caseTo) {
			if (typeof text !== "string") {
				throw new sb.Error({
					message: "Text must be typeof string",
					args: arguments
				});
			}

			let words = [];
			if (caseFrom === "camel" && caseTo === "snake") {
				words = text.split(/(?=[A-Z])/);
			}
			else if (caseFrom === "snake" && caseTo === "camel") {
				words = text.split("_");
			}

			let result = "";
			if (caseTo === "snake") {
				result = words.map(i => this.capitalize(i)).join("_");
			}
			else if (caseTo === "camel") {
				result = words.map((i, ind) => (ind === 0) ? i.toLowerCase() : this.capitalize(i)).join("");
			}

			return result.replace(/id$/i, "ID");
		}

		convertCaseObject (object, caseFrom, caseTo) {
			let result = {};
			for (const [key, value] of Object.entries(object)) {
				if (value && value.constructor === Object) {
					result[this.convertCase(key, caseFrom, caseTo)] = this.convertCaseObject(value, caseFrom, caseTo);
				}
				else if (Array.isArray(value) && value.every(i => i && i.constructor === Object)) {
					result[this.convertCase(key, caseFrom, caseTo)] = value.map(i => this.convertCaseObject(i, caseFrom, caseTo));
				}
				else {
					result[this.convertCase(key, caseFrom, caseTo)] = value;
				}
			}

			return (Array.isArray(object))
				? Object.values(result)
				: result;
		}

		isValidInteger (input, minLimit = 0) {
			if (typeof input !== "number") {
				return false;
			}

			return Boolean(Number.isFinite(input) && Math.trunc(input) === input && input >= minLimit);
		}

		/**
		 * Transliterates non-latin text into latin characters.
		 * @param {...string} args
		 * @returns {string}
		 */
		transliterate (...args) {
			if (!this.Transliterate) {
				this.Transliterate = require("transliteration").transliterate;
			}

			return this.Transliterate(...args);
		}

		/**
		 * Splits an array into two, based on the condition function.
		 * @param {Array} array
		 * @param {Function} filter Takes three arguments: (item, index, array)
		 * @returns {[Array, Array]} Two arrays: First one with condition === true, second one with false.
		 */
		splitByCondition (array, filter) {
			if (!Array.isArray(array)) {
				throw new sb.Error({
					message: "array must be an Array"
				});
			}

			const yes = [];
			const no = [];
			for (let i = 0; i < array.length; i++) {
				if (filter(array[i], i, array)) {
					yes.push(array[i]);
				}
				else {
					no.push(array[i]);
				}
			}

			return [yes, no];
		}

		/**
		 * Attempts to fetch a Twitch ID from user cache.
		 * If it doesn't find one, queries the Twitch API endpoint.
		 * @param {string} user
		 * @returns {Promise<null|number>}
		 */
		async getTwitchID (user) {
			let userData = await sb.User.get(user, true);
			if (userData && userData.Twitch_ID) {
				return userData.Twitch_ID;
			}
			else {
				const channelInfo = JSON.parse(await sb.Utils.request({
					method: "GET",
					url: "https://api.twitch.tv/helix/users?login=" + user,
					headers: {
						"Client-ID": sb.Config.get("TWITCH_CLIENT_ID")
					}
				}));

				if (channelInfo.data.length !== 0) {
					const {id, display_name: name} = channelInfo.data[0];
					if (!userData) {
						userData = await sb.User.get(name, false);
					}

					await userData.saveProperty("Twitch_ID", id);
					return id;
				}
			}

			return null;
		}

		parseURL (stringURL) {
			return urlParser(stringURL);
		}

		/**
		 * Utils wrapper for the cheerio module.
		 * @param {string} html
		 * @returns {Cheerio}
		 */
		cheerio (html) {
			if (!this.Cheerio) {
				this.Cheerio = require("cheerio");
			}

			return this.Cheerio.load(html);
		}

		get modulePath () { return "utils"; }

		/** @inheritDoc */
		destroy () {
			this.YoutubeUtils = null;
			this.duration = null;
			this.mersenneRandom = null;
		}
	};
});