module.exports = {
	Name: "randomcommandalias",
	Aliases: ["rca"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random Supibot command alias. Can be configured to create a somewhat precise search query.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomCommandAlias () {
		const randomAlias = await sb.Query.getRecordset(rs => rs
			.select("ID", "User_Alias", "Name")
			.from("data", "Custom_Command_Alias")
			.where("Command IS NOT NULL")
			.where("Parent IS NULL OR Edited IS NOT NULL") // either an original alias or an edited copy
			.orderBy("RAND()")
			.limit(1)
			.single()
		);

		const userData = await sb.User.get(randomAlias.User_Alias);
		return {
			reply: `
				Random alias "${randomAlias.Name} from ${userData.Name}:
				https://supinic.com/bot/user/alias/detail${randomAlias.ID}				
			`
		};
	}),
	Dynamic_Description: null
};
