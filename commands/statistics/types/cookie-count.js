module.exports = {
	name: "cookiecount",
	aliases: ["cc", "tcc", "cookie", "cookies"],
	description: "Fetches the amount of cookies you (or someone else) have eaten so far. If you use \"total\", then you will see the total amount of cookies eaten.",
	execute: async (context, type, user) => {
		if (user === "total" || type === "tcc") {
			const data = await sb.Query.getRecordset(rs => rs
				.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.total.eaten.daily'), INT)) AS Modern`)
				.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.legacy.daily'), INT)) AS Legacy`)
				.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.total.donated'), INT)) AS Donated`)
				.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.legacy.donated'), INT)) AS Legacy_Donated`)
				.from("chat_data", "User_Alias_Data")
				.where("Property = %s", "cookie")
				.single()
			);

			const total = sb.Utils.groupDigits(data.Modern + data.Legacy);
			const donated = sb.Utils.groupDigits(data.Donated + data.Legacy_Donated);

			return {
				reply: `${total} cookies have been eaten so far in total, out of which ${donated} were gifted :)`
			};
		}
		else if (user === "list") {
			return {
				reply: "Check the cookie statistics here: https://supinic.com/bot/cookie/list"
			};
		}

		const targetUser = await sb.User.get(user ?? context.user, true);
		if (!targetUser) {
			return {
				success: false,
				reply: "I have never seen that user, so they definitely didn't eat any of my cookies!"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emoji = context.getBestAvailableEmote(["supiniScience", "peepoZ", ":z"], "😐");
			return {
				success: false,
				reply: `I don't eat cookies! ${emoji} 🍪 Sugar is bad for my circuits...`
			};
		}

		/** @type {CookieData|null} */
		const cookieData = await targetUser.getDataProperty("cookie");
		const { total, legacy } = cookieData;
		const [who, target] = (context.user.ID === targetUser.ID)
			? ["You have", "you"]
			: ["That user has", "them"];

		if (!cookieData || cookieData.total.eaten.daily === 0) {
			return {
				reply: `${who} never eaten a single cookie 🙁`
			};
		}

		// Legacy daily stats are based on the following calculation:
		// `const total = cookies.Daily + cookies.Received - cookies.Sent + cookies.Today;`
		const legacyDaily = legacy.daily + legacy.received - legacy.donated;
		const daily = total.eaten.daily + legacyDaily;
		const received = total.eaten.received + legacy.received;
		const donated = total.donated + legacy.donated;

		const donatedString = (donated === 0)
			? `${who} never given out a single cookie`
			: `${who} gifted away ${donated} cookie(s)`;

		let reaction;
		const percentage = sb.Utils.round((donated / (daily + donated)) * 100, 0);
		if (percentage <= 0) {
			reaction = "😧 what a scrooge 😒";
			if (received > 100) {
				reaction += " and a glutton 😠🍔";
			}
		}
		else if (percentage < 15) {
			reaction = "🤔 a little frugal 😑";
		}
		else if (percentage < 40) {
			reaction = "🙂 a fair person 👍";
		}
		else if (percentage < 75) {
			reaction = "😮 a great samaritan 😃👌";
		}
		else {
			reaction = "😳 an absolutely selfless saint 😇";
		}

		return {
			reply: sb.Utils.tag.trim `
				${who} eaten ${daily} cookies so far.
			    ${received} were gifted to ${target}.
			    ${donatedString}
			    ${reaction}
			`
		};
	}
};
