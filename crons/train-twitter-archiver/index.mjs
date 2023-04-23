export const definition = {
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

		const response = await sb.Got("Supinic", {
			url: `twitter/timeline/trainwreckstv`
		});

		const tweets = response.body.data.timeline;
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

			const row = await sb.Query.getRow("twitter", "Tweet");
			row.setValues({
				ID,
				User: tweet.user_id_str,
				Text: sb.Utils.fixHTML(tweet.full_text),
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
