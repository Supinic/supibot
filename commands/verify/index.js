module.exports = {
	Name: "verify",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Verifies a user to be able to use a specific command based on some requirement.",
	Flags: ["mention","pipe","system","whitelist"],
	Params: null,
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

		const animalsData = await userData.getDataProperty("animals") ?? {};
		if (animalsData[type]) {
			return {
				reply: `That user is already verified for ${type}(s). If you want to add more pictures, do it manually please :)`
			};
		}

		animalsData[type] = {
			verified: true,
			notes: rest.join(" ")
		};

		await userData.setDataProperty("animals", animalsData);
		return {
			reply: `Okay, they are now verified to use ${type}-related commands :)`
		};
	}),
	Dynamic_Description: null
};
