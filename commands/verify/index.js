module.exports = {
	Name: "verify",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 0,
	Description: "Verifies a user to be able to use a specific command based on some requirement.",
	Flags: ["mention","pipe","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function verify (context, type, user, ...rest) {
		if (!type || !user || rest.length === 0) {
			return {
				reply: "Some arguments are missing!"
			};
		}
	
		const allowedTypes = ["bird", "cat", "dog", "fox"];
		if (!allowedTypes.includes(type)) {
			return {
				reply: "Unknown animal type provided!"
			};
		}
	
		const userData = await sb.User.get(user);
		if (!userData) {
			return {
				reply: "Invalid user provided!"
			};
		}
	
		userData.Data.animals = userData.Data.animals ?? {};
		if (userData.Data.animals[type]) {
			return {
				reply: `That user is already verified for ${type}(s). If you want to add more pictures, do it manually please :)`
			}
		}
	
		userData.Data.animals[type] = {
			verified: true,
			notes: rest.join(" ")
		};
	
		await userData.saveProperty("Data", userData.Data);
	
		return {
			reply: `Okay, they are now verified to use ${type}-related commands :)`
		};
	}),
	Dynamic_Description: null
};