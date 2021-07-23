module.exports = {
	Name: "twitter",
	Aliases: ["tweet"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last tweet from a given user. No retweets or replies, just plain standalone tweets.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function twitter (context, user) {
		if (!user) {
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
				count: "1",
				exclude_replies: "true"
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

		const [tweet] = response.body;
		if (!tweet) {
			return {
				reply: "That account has not tweeted so far."
			};
		}

		const fixedText = sb.Utils.fixHTML(tweet.text);
		if (context.params.textOnly) {
			return {
				reply: fixedText
			};
		}

		const delta = sb.Utils.timeDelta(new sb.Date(tweet.created_at));
		return {
			reply: `${fixedText} (posted ${delta})`
		};
	}),
	Dynamic_Description: null
};
