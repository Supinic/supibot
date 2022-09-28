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
				const { Cookies_Total: cookies, User_Alias: user } = await sb.Query.getRecordset(rs => rs
					.select("Cookies_Total", "User_Alias")
					.from("chat_data", "Extra_User_Data")
					.orderBy("Cookies_Total DESC")
					.limit(1)
					.single()
				);

				const userData = await sb.User.get(user, true);
				return {
					reply: `Currently, the most consistent cookie consumer is ${userData.Name} with ${cookies} daily cookies eaten.`
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
