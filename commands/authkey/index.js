module.exports = {
	Name: "authkey",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Works with an authentication string used to access supinic.com APIs that require a login; outside of Twitch login.",
	Flags: ["developer","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function authKey (context, type) {
		const authKey = await context.user.getDataProperty("authKey");
		switch (type) {
			case "invalidate": {
				if (!authKey) {
					return {
						success: false,
						reply: "You have no authentication key set up!"
					};
				}

				await context.user.setDataProperty("authKey", null);
				return {
					reply: "Authentication key invalidated successfully."
				};
			}

			case "generate": {
				if (!context.privateMessage) {
					return {
						success: false,
						reply: "You can only generate a new key via private messages!"
					};
				}
				else if (authKey) {
					return {
						success: false,
						reply: "You already have an authentication key set up! Invalidate it first and then generate a new one."
					};
				}

				const crypto = require("crypto");
				const hashString = crypto.createHash("sha3-256")
					.update(context.user.Name)
					.update(context.user.ID.toString())
					.update(new sb.Date().valueOf().toString())
					.update(crypto.randomBytes(256).toString())
					.digest("hex");

				await context.user.setDataProperty("authKey", hashString);
				return {
					reply: `Your authentication key is: ${hashString}`
				};
			}

			default: return {
				success: false,
				reply: "You must supply a mode, one of: \"generate\", \"invalidate\""
			};
		}
	}),
	Dynamic_Description: null
};
