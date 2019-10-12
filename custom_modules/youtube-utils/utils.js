module.exports = (function () {
	"use strict";

	const request = require("custom-request-promise");
	const lookup = require("youtube-search");
	const extraURL = (key, id) => `https://www.googleapis.com/youtube/v3/videos?part=contentDetails%2Cstatistics&key=${key}&id=${id}`
	
	const durationRegex = /PT((?<hours>\d+)H)?((?<minutes>\d+)M)?((?<seconds>\d+)S)?/g;
	const idTestRegex = /^[^#&?]{11}$/;
	const splitRegex = /[/&?=#.\s]/g;
	const patterns = [
		/youtu\.be\/([^#&?]{11})/, // youtu.be/<id>
		/\?v=([^#&?]{11})/, // ?v=<id>
		/&v=([^#&?]{11})/, // &v=<id>
		/embed\/([^#&?]{11})/, // embed/<id>
		/\/v\/([^#&?]{11})/ // /v/<id>
	];
	
	return class YoutubeUtils {
		/**
		 * based on npm module get-youtube-id by @jmorrell
		 * converted into ES6 syntax and simplified by @supinic
		 * Matches a Youtube video ID.
		 * @param {string} url
		 * @returns {string|null} Youtube video ID, or null if one was found.
		 */
		static match (url) {
			// If any pattern matches, return the ID
			for (const pattern of patterns) {
				if (pattern.test(url)) {
					return pattern.exec(url)[1];
				}
			}

			// If that fails, split it apart and look for any exactly 11 character long key
			const tokens = url.split(splitRegex);
			for (const token of tokens) {
				if (idTestRegex.test(token)) {
					return token;
				}
			}
		
			return null;
		}

		/**
		 * Parses a ISO-8601 duration to a number representing the time in seconds
		 * @param {string} string
		 * @returns {number}
		 */
		static parseDuration (string) {
			return Number(string.replace(durationRegex, (...args) => {
				const {hours, minutes, seconds} = args[args.length - 1];
				return (Number(hours) * 3600 || 0) + (Number(minutes) * 60 || 0) + (Number(seconds) || 0);
			}));
		}

		/**
		 * Finds basic data about a Youtube video.
		 * @private
		 * @param videoID
		 * @param key
		 * @returns {Promise<Object>}
		 */
		static async find (key, videoID) {
			return await lookup(videoID, {
				type: "video",
				maxResults: 10,
				key: key
			});
		}

		/**
		 * Fetches all relevant data about a Youtube video.
		 * @param {string} key Youtube API key
		 * @param {string} videoString A string describing the Youtube video
		 * @returns {Promise<YoutubeDataObject>}
		 */
		static async fullFetch (key, videoString) {
			let matched  = false;
			const matchedID = YoutubeUtils.match(videoString);
			if (matchedID) {
				matched = true;
				videoString = matchedID;
			}

			const results = (await YoutubeUtils.find(key, videoString)).results;
			const data = (matched)
				? results.find(i => i.id === matchedID)
				: results[0];

			if (!data) {
				return null;
			}

			const extraData = JSON.parse(await request(extraURL(key, data.id))).items[0];
			return {
				id: videoString,
				author: data.channelTitle,
				name: data.title,
				link: data.link,
				posted: new Date(data.publishedAt).valueOf(),
				rawLength: extraData.contentDetails.duration,
				length: YoutubeUtils.parseDuration(extraData.contentDetails.duration),
				views: Number(extraData.statistics.viewCount),
				comments: Number(extraData.statistics.commentCount),
				likes: Number(extraData.statistics.likeCount),
				dislikes: Number(extraData.statistics.dislikeCount)
			};
		}
	};
})();

/**
 * @typedef {Object} YoutubeDataObject
 * @property {string} id Video ID
 * @property {string} author Video author
 * @property {string} name Video name
 * @property {string} link Video link
 * @property {number} posted Timestamp of video publishing
 * @property {number} length Length of video in seconds
 * @property {number} comments Current amount of comments
 * @property {number} views Current amount of views the video has
 * @property {number} likes Current amount of likes the video has
 * @property {number} dislikes Current amount of dislikes the video has
 */