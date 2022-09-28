module.exports = {
	Name: "cookie",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Open a random fortune cookie wisdom. Watch out - only one allowed per day, and no refunds! Daily reset occurs at midnight UTC.",
	Flags: ["mention","pipe","rollback"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cookie (context, check) {
		if (check === "check") {
			return {
				success: false,
				reply: `Use the check command instead!`
			};
		}
		else if (check === "gift" || check === "give") {
			return {
				success: false,
				reply: `Use the give command instead!`
			};
		}

		const data = await sb.Query.getRecordset(rs => rs
			.select("Cookie_Today")
			.from("chat_data", "Extra_User_Data")
			.where("User_Alias = %n", context.user.ID)
			.single()
		);

		if (data?.Cookie_Today) {
			const tomorrow = new sb.Date().addDays(1);
			const nextMidnight = new sb.Date(sb.Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()));
			const delta = sb.Utils.timeDelta(nextMidnight);

			const rudeRoll = sb.Utils.random(1, 100);
			return {
				success: false,
				reply: (rudeRoll === 99)
					? `Stop stuffing your face so often! What are you doing, do you want to get fat? Get another cookie ${delta}.`
					: `You already opened or gifted a fortune cookie today. You can get another one at midnight UTC, which is ${delta}.`
			};
		}

		const [cookie] = await sb.Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Fortune_Cookie")
			.orderBy("RAND() DESC")
			.limit(1)
		);

		await context.transaction.query([
			"INSERT INTO chat_data.Extra_User_Data (User_Alias, Cookie_Today)",
			`VALUES (${context.user.ID}, 1)`,
			"ON DUPLICATE KEY UPDATE Cookie_Today = 1"
		].join(" "));

		return {
			reply: cookie.Text
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const tomorrow = new sb.Date().addDays(1);
		const nextMidnight = new sb.Date(sb.Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()));
		const delta = sb.Utils.timeDelta(nextMidnight);

		return [
			"Fetch a daily fortune cookie and read its wisdom!",
			`Only available once per day, and resets at midnight UTC, which is ${delta}`,
			"",

			`Cookies can also be gifted to other users, via the <a href="/bot/command/detail/gift"><code>${prefix}gift cookie</code></a> command.`,
			`You can check the <a href="/bot/cookie/list">cookie leaderboards as well</a>.`,
			"",

			`<code>${prefix}cookie</code>`,
			"Opens your daily fortune cookie.",
			""
		];
	})
};
