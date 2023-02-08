module.exports = {
	name: "twitchlotto",
	aliases: ["tl"],
	description: "Posts stats for the $twitchlotto command - globally, or for a selected channel. You can use <code>recalculate:true</code> to force an update for the statistics in a specific channel.",
	execute: async (context, type, channel) => {
		if (channel) {
			const lottoData = await sb.Query.getRecordset(rs => rs
				.select("Amount", "Scored", "Tagged")
				.from("data", "Twitch_Lotto_Channel")
				.where("Name = %s", channel)
				.single()
			);

			if (!lottoData) {
				return {
					success: false,
					reply: `Provided channel does not exists in the twitchlotto command!`
				};
			}

			const obj = {
				total: lottoData.Amount,
				scored: lottoData.Scored,
				tagged: lottoData.Tagged
			};

			if (context.params.recalculate) {
				const [total, scored, tagged, deleted] = await Promise.all([
					sb.Query.getRecordset(rs => rs
						.select("COUNT(*) AS Count")
						.from("data", "Twitch_Lotto")
						.where("Channel = %s", channel)
						.where("Available = %b OR Available IS NULL", true)
						.single()
						.flat("Count")
					),
					sb.Query.getRecordset(rs => rs
						.select("COUNT(*) AS Count")
						.from("data", "Twitch_Lotto")
						.where("Channel = %s", channel)
						.where("Score IS NOT NULL")
						.where("Available = %b OR Available IS NULL", true)
						.single()
						.flat("Count")
					),
					sb.Query.getRecordset(rs => rs
						.select("COUNT(*) AS Count")
						.from("data", "Twitch_Lotto")
						.where("Channel = %s", channel)
						.where("Score IS NOT NULL")
						.where("Adult_Flags IS NOT NULL")
						.where("Available = %b OR Available IS NULL", true)
						.single()
						.flat("Count")
					),
					sb.Query.getRecordset(rs => rs
						.select("COUNT(*) AS Count")
						.from("data", "Twitch_Lotto")
						.where("Channel = %s", channel)
						.where("Available = %b", false)
						.single()
						.flat("Count")
					)
				]);

				await sb.Query.getRecordUpdater(ru => ru
					.update("data", "Twitch_Lotto_Channel")
					.set("Amount", total)
					.set("Scored", scored)
					.set("Tagged", tagged)
					.set("Unavailable", deleted)
					.where("Name = %s", channel)
				);

				obj.scored = scored;
				obj.tagged = tagged;
				obj.total = total;
			}

			const scorePercent = sb.Utils.round(obj.scored / obj.total * 100, 2);
			const tagPercent = sb.Utils.round(obj.tagged / obj.total * 100, 2);

			return {
				reply: sb.Utils.tag.trim `
					Channel "${channel}" has ${sb.Utils.groupDigits(obj.total)} TwitchLotto images in total.
					${sb.Utils.groupDigits(obj.scored)} (${scorePercent}%) have been rated by the NSFW AI,
					and out of those, ${sb.Utils.groupDigits(obj.tagged)} (${tagPercent}%) have been flagged by contributors.
				`
			};
		}
		else {
			const lottoData = await sb.Query.getRecordset(rs => rs
				.select("SUM(Amount) AS Amount", "SUM(Scored) AS Scored", "SUM(Tagged) AS Tagged")
				.from("data", "Twitch_Lotto_Channel")
				.single()
			);

			const scorePercent = sb.Utils.round(lottoData.Scored / lottoData.Amount * 100, 2);
			const tagPercent = sb.Utils.round(lottoData.Tagged / lottoData.Amount * 100, 2);

			return {
				reply: sb.Utils.tag.trim `
					The TwitchLotto database has ${sb.Utils.groupDigits(lottoData.Amount)} images in total.
					${sb.Utils.groupDigits(lottoData.Scored)} (${scorePercent}%) have been rated by the NSFW AI,
					and out of those, ${sb.Utils.groupDigits(lottoData.Tagged)} (${tagPercent}%) have been flagged by contributors.
				`
			};
		}
	}
};
