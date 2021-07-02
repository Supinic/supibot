module.exports = {
	Name: "lastcommand",
	Aliases: ["_"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts your last command executed in the current channel. Only goes back up to 1 minute.",
	Flags: ["pipe"],
	Params: [
		{ name: "input", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function lastCommand (context, user) {
		const targetUser = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		if (targetUser !== context.user && !context.channel) {
			return {
				success: false,
				reply: "Cannot check other users' last command here!"
			};
		}

		const data = await sb.Query.getRecordset(rs => {
			rs.select("Result", "Invocation", "Arguments")
				.from("chat_data", "Command_Execution")
				.where("Command <> %n", this.ID)
				.where("User_Alias = %n", targetUser.ID)
				.where("Executed > DATE_ADD(NOW(), INTERVAL -1 MINUTE)")
				.where("Result IS NOT NULL")
				.orderBy("Executed DESC")
				.limit(1)
				.single();

			if (context.channel) {
				rs.where("Channel = %n", context.channel.ID);
			}
			else {
				rs.where("Channel IS NULL").where("Platform = %n", context.platform.ID);
			}

			return rs;
		});

		if (!data || !data.Result) {
			return {
				success: false,
				reply: "No recent command execution found!"
			};
		}
		else if (context.params.input) {
			const args = JSON.parse(data.Arguments).join(" ");
			return {
				reply: `${data.Invocation} ${args}`
			};
		}
		else {
			return {
				reply: String(data.Result)
			};
		}
	}),
	Dynamic_Description: null
};
