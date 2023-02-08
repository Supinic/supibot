module.exports = {
	Name: "record",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks for various max/min records of various sources.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: [
			{
				name: "afk",
				aliases: [],
				description: "Posts the longest time you were AFK for."
			},
			{
				name: "cookie",
				aliases: [],
				description: "Posts stats for whoever ate the most fortune cookies."
			}
		]
	})),
	Code: (async function record (context, type, target) {
		const types = this.staticData.types.map(i => i.name);
		if (!type) {
			return {
				success: false,
				reply: `No type provided! Use one of these: ${types.join(", ")}`
			};
		}

		type = type.toLowerCase();
		target = target || context.user;
		const userData = await sb.User.get(target);

		switch (type) {
			case "afk": {
				if (userData.ID !== context.user.ID) {
					return {
						reply: "Cannot be checked on people other than you!"
					};
				}

				const data = await sb.Query.getRecordset(rs => rs
					.select("Ended")
					.select("(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) AS Seconds")
					.from("chat_data", "AFK")
					.where("User_Alias = %n", userData.ID)
					.where("Ended IS NOT NULL")
					.orderBy("Seconds DESC")
					.limit(1)
					.single()
				);

				if (!data) {
					return {
						reply: "No AFK status found!"
					};
				}

				const formatted = sb.Utils.formatTime(sb.Utils.round(data.Seconds, 0), false);
				const delta = sb.Utils.timeDelta(data.Ended);
				return {
					reply: `Your longest AFK period lasted for ${formatted} - this was ${delta}.`
				};
			}

			case "cookie": {
				const data = await sb.Query.getRecordset(rs => rs
					.select("CONVERT(JSON_EXTRACT(Value, '$.total.eaten.daily'), INT) AS Daily")
					.select("CONVERT(JSON_EXTRACT(Value, '$.legacy.daily'), INT) AS Legacy")
					.select("User_Alias")
					.from("chat_data", "User_Alias_Data")
					.where("Property = %s", "cookie")
					.orderBy("(Daily + Legacy) DESC")
					.single()
					.limit(1)
				);

				const total = data.Daily + data.Legacy;
				const userData = await sb.User.get(data.User_Alias, true);
				return {
					reply: `Currently, the most consistent cookie consumer is ${userData.Name} with ${total} daily cookies eaten (out of which ${data.Legacy} are legacy).`
				};
			}

			default: return {
				success: false,
				reply: `Invalid type provided! Use one of these: ${types.join(", ")}`
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const { types } = this.staticData;
		const list = types.map(i => {
			const aliases = (i.aliases.length > 0)
				? `(${i.aliases.join(", ")})`
				: "";

			return `<li><code>${i.name}${aliases}</code><br>${i.description}</li>`;
		});

		return [
			"Checks for various max/min records of various sources within Supibot.",
			"",

			`<code>${prefix}record (type)</code>`,
			"For a given type, checks that specific record at the moment of command use.",

			"Types:",
			`<ul>${list.join("")}</ul>`
		];
	})
};
