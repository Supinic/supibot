module.exports = {
	Name: "cookiecount",
	Aliases: ["cc","tcc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the amount of cookies you (or someone else) have eaten so far. If you use \"total\", then you will see the total amount of cookies eaten.",
	Flags: ["archived","mention","opt-out","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cookieCount (context, user) {
		if (user === "total" || context.invocation === "tcc") {
			const cookies = await sb.Query.getRecordset(rs => rs
				.select("SUM(Cookies_Total) AS Total", "SUM(Cookie_Gifts_Sent) AS Gifts")
				.from("chat_data", "Extra_User_Data")
				.single()
			);
	
			return {
				reply: cookies.Total + " cookies have been eaten so far, out of which " + cookies.Gifts + " were gifted :)"
			};
		}
		else if (user === "list") {
			return {
				reply: "Check the cookie statistics here: https://supinic.com/bot/cookie/list"
			};
		}
	
		const targetUser = await sb.User.get(user || context.user, true);
		if (!targetUser) {
			return { reply: "Target user does not exist in the database!" };
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return { reply: "I don't eat cookies, sugar is bad for my circuits!" };
		}	
	
		const cookies = await sb.Query.getRecordset(rs => rs
			.select("Cookie_Today AS Today", "Cookies_Total AS Daily")
			.select("Cookie_Gifts_Sent AS Sent", "Cookie_Gifts_Received AS Received")
			.from("chat_data", "Extra_User_Data")
			.where("User_Alias = %n", targetUser.ID)
			.single()
		);
	
		const [who, target] = (context.user.ID === targetUser.ID)
			? ["You have", "you"]
			: ["That user has", "them"];
	
		if (!cookies || cookies.Daily === 0) {
			return { reply: who + " never eaten a single cookie!" };
		}
		else {
			// Today = has a cookie available today
			// Daily = amount of eaten daily cookies
			// Received = amount of received cookies, independent of Daily
			// Sent = amount of sent cookies, which is subtracted from Daily
	
			const total = cookies.Daily + cookies.Received - cookies.Sent + cookies.Today;
			const giftedString = (cookies.Sent === 0)
				? `${who} never given out a single cookie`
				: `${who} gifted away ${cookies.Sent} cookie(s)`;
	
			let reaction;
			const percentage = sb.Utils.round((cookies.Sent / total) * 100, 0);
			if (percentage <= 0) {
				reaction = "😧 what a scrooge 😒";
				if (cookies.Received > 100) {
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
	
			let voidString = "";
			if (total < cookies.Received) {
				voidString = ` (the difference of ${cookies.Received - total} has been lost to the Void)`;
			}
	
			return {
				reply: `${who} eaten ${total} cookies so far. Out of those, ${cookies.Received} were gifted to ${target}${voidString}. ${giftedString} ${reaction} ❗ This command will soon be archived. Use ⇒ "$stats ${context.invocation} (user)" based on the current invocation, with the user included.`
			};
		}
	}),
	Dynamic_Description: (async (prefix) =>  [
		`Checks the amount of cookies a given person (or yourself) have eaten so far.`,
		`You can use <code>${prefix}cc total</code> or <code>${prefix}tcc</code> to get total statistics.`,
		``,
	
		`<code>${prefix}cc</code>`,
		`You have eaten X cookies so far. Out of those, Y were gifted to you. You gifted Z cookies to other people :)`,
		``,
	
		`<code>${prefix}cc (user)</code>`,
		`They have eaten X cookies so far. Out of those, Y were gifted to them. They gifted Z cookies to other people :)`,
		``,
	
		`<code>${prefix}cc total</code>`,
		`X cookies have been eaten so far, out of which Y were gifted :)`,
		``,
		
		`<code>${prefix}cc list</code>`,
		`<a href='/bot/cookie/list'>https://supinic.com/bot/cookie/list</a>`,
		``
	])
};