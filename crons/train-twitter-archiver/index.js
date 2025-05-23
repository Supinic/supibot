export default {
	name: "train-twitter-archiver",
	expression: "0 */15 * * * *",
	description: "Archives @Trainwreckstv's tweets",
	code: (async function archiveTrainsTweets () {
		if (!sb.Command) {
			return;
		}

		const response = await core.Got.get("Supinic")({
			url: `twitter/timeline/trainwreckstv`
		});

		const tweets = response.body.data.timeline;
		const existingTweetIDs = await core.Query.getRecordset(rs => rs
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

			const row = await core.Query.getRow("twitter", "Tweet");
			row.setValues({
				ID,
				User: tweet.user_id_str,
				Text: core.Utils.fixHTML(tweet.full_text),
				Created: new sb.Date(tweet.created_at),
				Reply_Tweet: null,
				Reply_User: null,
				Language: tweet.lang,
				Source: null,
				Place: null
			});

			await row.save({ skipLoad: true });
		}
	})
};
