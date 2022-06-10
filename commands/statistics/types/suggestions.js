module.exports = {
	name: "suggestion",
	aliases: ["suggest", "suggestions"],
	description: "Posts your (or someone else's) amount of suggestions, and the percentage of total. Also posts some neat links.",
	execute: async (context, type, user) => {
		const userData = (user)
			? await sb.User.get(user)
			: context.user;

		if (!userData) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		const { data } = await sb.Got("Supinic", `/data/suggestion/stats/user/${userData.Name}`).json();
		const percent = sb.Utils.round(data.userTotal / data.globalTotal * 100, 2);
		const who = (userData === context.user) ? "You" : "They";

		return {
			reply: sb.Utils.tag.trim `
				${who} have made ${data.userTotal} suggestions, out of ${data.globalTotal} (${percent}%)							
				More info: https://supinic.com/data/suggestion/stats/user/${userData.Name}
				--
				Global suggestion stats: https://supinic.com/data/suggestion/stats
			`
		};
	}
};
