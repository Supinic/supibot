/* global sb */
module.exports = (function (Module) {
	"use strict";

	return class Twitter extends Module {
		static singleton () {
			if (!Twitter.module) {
				Twitter.module = new Twitter();
			}
			return Twitter.module;
		}

		static userParams (user, max) {
			return {
				screen_name: user,
				count: max,
				exclude_replies: true,
				include_rts: false
			};
		}

		constructor () {
			super();

			const TwitterClient = require("twitter");
			this.client = new TwitterClient({
				consumer_key: sb.Config.get("TWITTER_CONSUMER_KEY"),
				consumer_secret: sb.Config.get("TWITTER_CONSUMER_SECRET"),
				access_token_key: sb.Config.get("TWITTER_ACCESS_TOKEN_KEY"),
				access_token_secret: sb.Config.get("TWITTER_ACCESS_TOKEN_SECRET")
			});
		}

		lastUserTweets (user) {
			return new Promise((resolve, reject) => {
				this.client.get("statuses/user_timeline", Twitter.userParams(user, 1), (err, resp) => {
					if (err) {
						sb.SystemLogger.send("Command.Warning", err.toString());
						resolve({
							success: false,
							text: "Twitter account '" + user + "' not found, or it is protected."
						});
					}
					else {
						if (resp && Array.isArray(resp) && resp.length > 0) {
							resolve({
								success: true,
								date: new sb.Date(resp[0].created_at).valueOf(),
								text: resp[0].text
							});
						}
						else {
							resolve ({
								success: false,
								text: "That twitter account was not found, or it is protected."
							});
						}
					}
				});
			});
		}

		raw (request, url, params) {
			return new Promise((resolve, reject) => {
				this.client[request](url, params, (err, resp) => {
					if (err) {
						reject(err);
					}
					else {
						resolve(resp);
					}
				});
			});
		}

		get modulePath () { return "twitter"; }

		destroy () {
			this.client = null;
		}
	};
});