module.exports = {
	Name: "train-twitter-archiver",
	Expression: "0 */15 * * * *",
	Description: "Archives @Trainwreckstv's tweets",
	Defer: (() => ({
		start: 0,
		end: 600000
	})),
	Type: "Bot",
	Code: (async function archiveTrainsTweets () {
		if (!sb.Command) {
			return;
		}

		const cmd = sb.Command.get("twitter");
		if (!cmd) {
			return;
		}

		const token = await cmd.getCacheData("bearer-token");
		if (!token) {
			return; // possibly run the command to re-init the token and fetch it again from Redis
		}

		const response = await sb.Got("GenericAPI", {
			method: "GET",
			url: "https://api.twitter.com/1.1/statuses/user_timeline.json",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Authorization: `Bearer ${token}`
			},
			searchParams: {
				screen_name: "trainwreckstv",
				count: "100",
				trim_user: "false",
				include_rts: "false",
				exclude_replies: "false",
				tweet_mode: "extended"
			}
		});

		const tweets = response.body;

		const existingUserIDs = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("twitter", "User")
			.flat("ID")
		);

		const existingTweetIDs = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("twitter", "Tweet")
			.where("ID IN %s+", tweets.map(i => i.id_str))
			.flat("ID")
		);

		for (const tweet of tweets) {
			const ID = tweet.id_str;
			if (existingTweetIDs.includes(ID)) {
				continue;
			}

			const { user } = tweet;
			if (!existingUserIDs.includes(tweet.user.id_str)) {
				const row = await sb.Query.getRow("twitter", "User");
				row.setValues({
					ID: user.id_str,
					Account_Name: user.screen_name,
					Display_Name: user.name,
					Location: user.location
				});

				await row.save({ skipLoad: true });
				existingUserIDs.push(user.id_str);
			}

			if (tweet.in_reply_to_user_id_str && !existingUserIDs.includes(tweet.in_reply_to_user_id_str)) {
				const response = await sb.Got("GenericAPI", {
					method: "GET",
					url: "https://api.twitter.com/1.1/users/show.json",
					responseType: "json",
					throwHttpErrors: false,
					headers: {
						Authorization: `Bearer ${token}`
					},
					searchParams: {
						user_id: tweet.in_reply_to_user_id_str
					}
				});

				const user = response.body;
				const row = await sb.Query.getRow("twitter", "User");
				row.setValues({
					ID: user.id_str,
					Account_Name: user.screen_name,
					Display_Name: user.name,
					Location: user.location
				});

				await row.save({ skipLoad: true });
				existingUserIDs.push(user.id_str);
			}

			const row = await sb.Query.getRow("twitter", "Tweet");
			row.setValues({
				ID,
				User: user.id_str,
				Text: sb.Utils.fixHTML(tweet.full_text),
				Created: new sb.Date(tweet.created_at),
				Reply_Tweet: tweet.in_reply_to_status_id_str,
				Reply_User: tweet.in_reply_to_user_id_str,
				Language: tweet.lang,
				Source: tweet.source,
				Place: tweet.place
			});

			await row.save({ skipLoad: true });
		}
	})
};
