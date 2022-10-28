module.exports = {
	Name: "twitter",
	Aliases: ["tweet"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last tweet from a given user. No retweets or replies, just plain standalone tweets.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "includeRetweets", type: "boolean" },
		{ name: "mediaOnly", type: "boolean" },
		{ name: "random", type: "boolean" },
		{ name: "textOnly", type: "boolean" },
		{ name: "trends", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function twitter (context, user) {
		if (!user && !context.params.trends) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}

		let bearerToken = await this.getCacheData("bearer-token");
		if (!bearerToken) {
			const key = sb.Config.get("TWITTER_CONSUMER_KEY", false);
			const secret = sb.Config.get("TWITTER_CONSUMER_SECRET", false);
			if (!key || !secret) {
				return {
					success: false,
					reply: `Cannot fetch any tweets - Twitter configuration is missing!`
				};
			}

			const credentials = Buffer.from(`${key}:${secret}`, "utf-8").toString("base64");
			const response = await sb.Got("GenericAPI", {
				method: "POST",
				url: "https://api.twitter.com/oauth2/token",
				headers: {
					Authorization: `Basic ${credentials}`,
					"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
				},
				body: "grant_type=client_credentials",
				responseType: "json"
			});

			bearerToken = response.body.access_token;
			await this.setCacheData("bearer-token", bearerToken, {
				expiry: 30 * 864e5 // 30 days
			});
		}

		if (context.params.trends) {
			let locationsData = await this.getCacheData("trends-locations");
			if (!locationsData) {
				const response = await sb.Got("GenericAPI", {
					method: "GET",
					url: "https://api.twitter.com/1.1/trends/available.json",
					responseType: "json",
					throwHttpErrors: false,
					headers: {
						Authorization: `Bearer ${bearerToken}`
					}
				});

				locationsData = response.body.map(i => ({
					name: i.name,
					woeid: i.woeid,
					country: {
						name: i.country,
						code: i.countryCode
					},
					type: {
						/**
						 * 7 - Town (Toronto)
						 * 9 - Unknown (Ahsa)
						 * 12 - Country (Australia)
						 * 19 - Supername (Worldwide)
						 * 22 - Unknown (Soweto)
						 */
						code: i.placeType.code,
						name: i.placeType.name
					}
				}));

				await this.setCacheData("trends-locations", locationsData, {
					expiry: 30 * 864e5 // 30 days
				});
			}

			// Only support countries (for now) - ignores city-related trends
			const input = context.params.trends;
			const countryData = await sb.Query.getRecordset(rs => rs
				.select("Code_Alpha_2 AS Code")
				.select("Name")
				.from("data", "Country")
				.where("Name = %s OR Code_Alpha_2 = %s OR Code_Alpha_3 = %s", input, input, input)
				.single()
				.limit(1)
			);

			if (!countryData) {
				return {
					success: false,
					reply: `Could not match your query to a country!`
				};
			}

			const match = locationsData.find(i => i.country.code === countryData.Code);
			if (!match) {
				return {
					success: false,
					reply: `${countryData.Name} is not supported by Twitter Trends!`
				};
			}

			const response = await sb.Got("GenericAPI", {
				method: "GET",
				url: "https://api.twitter.com/1.1/trends/place.json",
				responseType: "json",
				throwHttpErrors: false,
				headers: {
					Authorization: `Bearer ${bearerToken}`
				},
				searchParams: {
					id: match.woeid
				}
			});

			const { trends } = response.body[0];
			const trendsString = trends.slice(0, 10)
				.sort((a, b) => (b.tweet_volume ?? 0) - (a.tweet_volume ?? 0))
				.map(i => {
					const volume = (i.tweet_volume)
						? sb.Utils.groupDigits(i.tweet_volume)
						: "N/A";

					return `${i.name} (${volume} tweets)`;
				})
				.join("; ");

			return {
				reply: `Current top 10 Twitter trends for ${match.name}: ${trendsString}.`
			};
		}

		// necessary to fetch - deleted/suspended tweets take up space in the slice
		const limit = (context.params.random) ? "200" : "100";
		const response = await sb.Got("GenericAPI", {
			method: "GET",
			url: "https://api.twitter.com/1.1/statuses/user_timeline.json",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Authorization: `Bearer ${bearerToken}`
			},
			searchParams: {
				screen_name: user,
				count: limit,
				trim_user: "true",
				include_rts: "true",
				exclude_replies: "true",
				tweet_mode: "extended"
			}
		});

		if (response.statusCode === 401) {
			return {
				success: false,
				reply: `This account is either suspended, private or has their replies limited to followers only!`
			};
		}
		else if (response.statusCode === 404) {
			return {
				success: false,
				reply: `That Twitter account does not exist!`
			};
		}

		/** @type {Object[]} */
		let eligibleTweets = response.body;
		if (!Array.isArray(eligibleTweets)) {
			await sb.Logger.log("Command.Warning", JSON.stringify({
				eligibleTweets,
				statusCode: response.statusCode
			}));

			return {
				success: false,
				reply: `Twitter response data is invalid! Contact @Supinic and/or try again later.`
			};
		}
		else if (!context.params.includeRetweets) {
			if (eligibleTweets.length === 0) {
				return {
					reply: "That account has not tweeted so far."
				};
			}

			const notRetweets = eligibleTweets.filter(i => !i.retweeted_status);
			if (notRetweets.length === 0) {
				return {
					success: false,
					reply: `All fetched tweets of this account are retweets! Use includeRetweets:true to fetch those as well.`
				};
			}

			eligibleTweets = notRetweets;
		}

		if (context.params.mediaOnly) {
			eligibleTweets = eligibleTweets.filter(i => Array.isArray(i.entities.media) && i.entities.media.length !== 0);
			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that have any kind of media attached to them!`
				};
			}
		}

		let tweet;
		if (context.params.random) {
			tweet = sb.Utils.randArray(eligibleTweets);
		}
		else {
			tweet = eligibleTweets[0];
		}

		if (!tweet) {
			return {
				reply: "That account has not tweeted so far."
			};
		}

		const delta = sb.Utils.timeDelta(new sb.Date(tweet.created_at));
		const fixedText = sb.Utils.fixHTML(tweet.full_text ?? "");
		if (context.params.mediaOnly) {
			const links = tweet.entities.media.map(i => i.media_url_https).join(" ");
			return {
				reply: (context.params.textOnly)
					? links
					: `${fixedText} ${links} (posted ${delta})`
			};
		}
		else {
			return {
				reply: (context.params.textOnly)
					? fixedText
					: `${fixedText} (posted ${delta})`
			};
		}
	}),
	Dynamic_Description: async (prefix) => [
		"Fetches the last tweet of a provided account.",
		"Excludes retweets by default - this can be changed with a parameter.",
		"",

		`<code>${prefix}tweet (account)</code>`,
		`<code>${prefix}twitter (account)</code>`,
		"Gets the last tweet.",
		"",

		`<code>${prefix}twitter trends:(location)</code>`,
		`<code>${prefix}twitter trends:France</code>`,
		`<code>${prefix}twitter trends:PL</code>`,
		`<code>${prefix}twitter trends:"United Arab Emirates"</code>`,
		"Fetches the top 10 trending hashtags for a given country, either as full name or code.",
		"",

		`<code>${prefix}twitter random:true (account)</code>`,
		"Instead of fetching the last tweet, fetches a random tweet from the account's recent history (up to 200 tweets)",
		"",

		`<code>${prefix}twitter includeRetweets:true (account)</code>`,
		"Gets the last tweet, including retweets",
		"",

		`<code>${prefix}twitter mediaOnly:true (account)</code>`,
		"Filters out all tweets that contain no media.",
		"",

		`<code>${prefix}twitter textOnly:true (account)</code>`,
		"Gets the text of the last tweet only - without the date of posting and all other descriptions that come with the command",
		"",

		`<code>${prefix}twitter textOnly:true mediaOnly:true (account)</code>`,
		"Filters out all tweets that contain no media, and only posts the link(s) to the media in a given tweet.",
		""
	]
};
