module.exports = {
	Name: "randomcommandalias",
	Aliases: ["rca"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random Supibot command alias. Can be configured to create a somewhat precise search query.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "command", type: "string" },
		{ name: "createdAfter", type: "date" },
		{ name: "createdBefore", type: "date" },
		{ name: "invocation", type: "string" },
		{ name: "name", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomCommandAlias (context) {
		const targetUserAlias = (context.params.user)
			? await sb.User.get(context.params.user)
			: null;

		if (context.params.user && !targetUserAlias) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		const randomAlias = await sb.Query.getRecordset(rs => rs
			.select("ID", "User_Alias", "Name")
			.from("data", "Custom_Command_Alias")
			.where({ condition: Boolean(context.params.command) }, "Command = %s", context.params.command)
			.where({ condition: Boolean(context.params.createdAfter) }, "Created > %d", context.params.createdAfter)
			.where({ condition: Boolean(context.params.createdBefore) }, "Created < %d", context.params.createdBefore)
			.where({ condition: Boolean(context.params.invocation) }, "Invocation %*like*", context.params.invocation)
			.where({ condition: Boolean(context.params.name) }, "Name = %s", context.params.name)
			.where("Command IS NOT NULL")
			.where("Parent IS NULL OR Edited IS NOT NULL") // either an original alias or an edited copy
			.orderBy("RAND()")
			.limit(1)
			.single()
		);
		
		if (!randomAlias) {
			return {
				success: false,
				reply: `No command alias has been found for your query!`
			};
		}

		const userData = await sb.User.get(randomAlias.User_Alias);
		return {
			reply: `
				Random alias "${randomAlias.Name}" from ${userData.Name}:
				https://supinic.com/bot/user/alias/detail/${randomAlias.ID}				
			`
		};
	}),
	Dynamic_Description: null
};
