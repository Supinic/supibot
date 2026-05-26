import type { StatsSubcommandDefinition } from "../index.js";

export const UserCookieCountStatistic = {
	name: "cookiecount",
	aliases: ["cc", "tcc", "cookie", "cookies"],
	title: "Cookies eaten",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats cc</code>`,
		`<code>${prefix}stats cookies</code>`,
		"Checks the total amount of cookies you have eaten, plus a quick \"karma check\" on how many you gifted vs. received.",
		"",

		`<code>${prefix}stats cc (user)</code>`,
		`<code>${prefix}stats cookies (user)</code>`,
		"Checks the cookies eaten for someone else, with the same karma check as above.",
		""
	],
	execute: async (context, _type, user) => {
		const targetUser = (user) ? await sb.User.get(user) : context.user;
		if (!targetUser) {
			return {
				success: false,
				reply: "I have never seen that user! That means they definitely didn't eat any of my cookies!"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			const emoji = await context.getBestAvailableEmote(["supiniScience", "peepoZ", ":z"], "😐");
			return {
				success: true,
				reply: `I don't eat cookies ${emoji} sugar is bad for my circuits...`
			};
		}

		const cookieData = await targetUser.getDataProperty("cookie");
		const [who, target] = (context.user.ID === targetUser.ID)
			? ["You have", "you"]
			: ["That user has", "them"];

		if (!cookieData) {
			return {
				success: true,
				reply: `${who} never eaten, donated or received a single cookie before 🙁`
			};
		}

		// Legacy daily stats are based on the following calculation:
		// `const total = cookies.Daily + cookies.Received - cookies.Sent + cookies.Today;`
		const { total, legacy } = cookieData;
		const legacyDaily = legacy.daily + legacy.received - legacy.donated;
		const daily = total.eaten.daily + total.eaten.received + legacyDaily;
		const received = total.eaten.received + legacy.received;
		const donated = total.donated + legacy.donated;
		if (daily === 0 && received === 0 && donated === 0) {
			return {
				success: true,
				reply: `${who} never eaten, donated or received a single cookie before 🙁`
			};
		}

		const eatenString = (daily === 0)
			? `${who} never eaten a single cookie.`
			: `${who} eaten ${daily} cookies so far.`;

		const donatedString = (donated === 0)
			? `${who} never given out a single cookie.`
			: `${who} gifted away ${donated} cookie(s).`;

		let reaction;
		const percentage = core.Utils.round((donated / (daily + donated)) * 100, 0);
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
			reply: core.Utils.tag.trim `
				${eatenString}
			    ${received} were gifted to ${target}.
			    ${donatedString}
			    ${reaction}
			`
		};
	}
} satisfies StatsSubcommandDefinition;

export const TotalCookieCountStatistic = {
	name: "totalcookiecount",
	aliases: ["tcc"],
	title: "Totalookies eaten",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats tcc</code>`,
		`<code>${prefix}stats totalcookiecount</code>`,
		"Checks the total amount of cookies everyone has eaten globally, in the entire history of Supibot."
	],
	execute: async () => {
		type CookieData = { modern: number; legacy: number; donated: number; legacyDonated: number; };
		const data = await core.Query.getRecordset<CookieData>(rs => rs
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.total.eaten.daily'), INT)) AS modern`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.legacy.daily'), INT)) AS legacy`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.total.donated'), INT)) AS donated`)
			.select(`SUM(CONVERT(JSON_EXTRACT(Value, '$.legacy.donated'), INT)) AS legacyDonated`)
			.from("chat_data", "User_Alias_Data")
			.where("Property = %s", "cookie")
			.single()
		);

		const total = core.Utils.groupDigits(data.modern + data.legacy);
		const donated = core.Utils.groupDigits(data.donated + data.legacyDonated);
		return {
			success: true,
			reply: `${total} cookies have been eaten so far in total, out of which ${donated} were gifted :)`
		};
	}
} satisfies StatsSubcommandDefinition;
