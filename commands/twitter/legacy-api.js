const fetchAuthData = async () => {
	const apiTokenKey = "twitter-api-bearer-token";
	let bearerToken = await sb.Cache.getByPrefix(apiTokenKey);

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
		await this.setCacheData(apiTokenKey, bearerToken, {
			expiry: 30 * 864e5 // 30 days
		});
	}

	return {
		success: true,
		bearerToken
	};
};

const fetchLocationsData = async (bearerToken) => {
	const trendLocationsKey = "trends-locations";
	let locationsData = await this.getCacheData(trendLocationsKey);
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

		await this.setCacheData(trendLocationsKey, locationsData, {
			expiry: 30 * 864e5 // 30 days
		});
	}

	return locationsData;
};

const getTrends = async (input, bearerToken) => {
	// Only support countries (for now) - ignores city-related trends
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

	const locationsData = await fetchLocationsData(bearerToken);
	const match = locationsData.find(i => i.type.name === "Country" && i.country.code === countryData.Code);
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
};

/*
const getTweet = async (context, bearerToken, user) => {
	// necessary to fetch this many - because deleted/suspended tweets take up space in the slice
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
			exclude_replies: (context.params.includeReplies) ? "false" : "true",
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

	let isSensitiveContentAllowed = false;
	if (!context.channel) {
		isSensitiveContentAllowed = true;
	}
	else {
		if (context.channel.NSFW) {
			isSensitiveContentAllowed = true;
		}

		isSensitiveContentAllowed = Boolean(await context.channel.getDataProperty("twitterNSFW"));
	}

	if (!isSensitiveContentAllowed) {
		eligibleTweets = eligibleTweets.filter(i => !i.possibly_sensitive);

		if (eligibleTweets.length === 0) {
			return {
				success: false,
				reply: `There are no recent tweets that are not marked as sensitive (NSFW) content!`
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

	const replyUrl = (context.params.includeReplies) ? `https://twitter.com/${user}/status/${tweet.id_str}` : "";
	const delta = sb.Utils.timeDelta(new sb.Date(tweet.created_at));
	const fullText = sb.Utils.fixHTML(tweet.full_text ?? "");
	const fixedText = `${fullText} ${replyUrl}`;

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
};
*/

const getSelloutDate = () => new sb.Date.UTC(2023, 2, 9);

module.exports = {
	fetchAuthData,
	getTrends,
	// getTweet,
	getSelloutDate
};
