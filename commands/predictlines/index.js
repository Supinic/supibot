module.exports = {
	Name: "predictlines",
	Aliases: ["pl"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Predicts the amount of lines a given user will have in some amount of time.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function predictLines (context, ...args) {
		const { time, ranges } = sb.Utils.parseDuration(args.join(" "), { returnData: true });
		if (time === 0 || ranges.length === 0) {
			return {
				success: false,
				reply: "No time data provided!"
			};
		}
		else if (time < 0) {
			return {
				success: false,
				reply: "Can't check for past data!"
			};
		}
	
		const timeRanges = ranges.flatMap(i => i.string.split(" "));
		const rest = args.filter(i => !timeRanges.includes(i));
	
		let userData = context.user;
		if (rest.length > 0) {
			userData = await sb.User.get(rest[0]);
		}
	
		if (!userData) {
			return { reply: "Provided user does not exist!" };
		}
	
		if (!time || time < 0) {
			return { reply: "Provided time must be valid and it must refer to future!" };
		}
	
		const total = (await sb.Query.getRecordset(rs => rs
			.select("SUM(Message_Count) AS Total")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.single()
		)).Total;
	
		const ratio = total / (sb.Date.now() - userData.Started_Using);
		const messages = sb.Utils.round(time * ratio, 0);
		if (messages > Number.MAX_SAFE_INTEGER) {
			return {
				reply: "There's too many lines to be precise! Try a smaller time interval."
			};
		}
	
		const who = (userData === context.user) ? "you" : "they";
		const when = new sb.Date().addMilliseconds(time);
		const whenString = (when.valueOf())
			? sb.Utils.timeDelta(when)
			: "too far in the future WAYTOODANK";
	
		return {
			reply: `I predict that ${who} will have sent ${messages} messages ${whenString}, on average.`
		};
	}),
	Dynamic_Description: null
};