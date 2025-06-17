const RECORD_TYPES = [
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
];
const RECORD_NAMES = RECORD_TYPES.map(i => i.name);

export default {
	Name: "record",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks for various max/min records of various sources.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function record (context, type, target) {
		if (!type) {
			return {
				success: false,
				reply: `No record type provided! Use one of these: ${RECORD_NAMES.join(", ")}`
			};
		}

		type = type.toLowerCase();
		target = target || context.user;
		const userData = await sb.User.get(target);

		switch (type) {
			case "afk": {
				if (userData.ID !== context.user.ID) {
					return {
						reply: "Cannot be checked on people other than yourself!"
					};
				}

				const data = await core.Query.getRecordset(rs => rs
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

				const formatted = core.Utils.formatTime(core.Utils.round(data.Seconds, 0), false);
				const delta = core.Utils.timeDelta(data.Ended);
				return {
					reply: `Your longest AFK period lasted for ${formatted} - this was ${delta}.`
				};
			}

			case "cookie": {
				const data = await core.Query.getRecordset(rs => rs
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

			default: {
				return {
					success: false,
					reply: `Invalid type provided! Use one of these: ${RECORD_NAMES.join(", ")}`
				};
			}
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const list = RECORD_TYPES.map(i => {
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
