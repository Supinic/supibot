module.exports = {
	Name: "gift",
	Aliases: ["give"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Gifts a certain something to someone else. Right now, supported parameters are: \"cookie\" - gifts your cooldown for a cookie to someone else!",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function gift (context, type, target) {
		if (!type) {
			return {
				success: false,
				reply: "No type provided!"
			};
		}
		else if (!target) {
			return {
				success: false,
				reply: "No user target provided!"
			};
		}
	
		const targetUserData = await sb.User.get(target, true);
		if (!targetUserData) {
			return {
				success: false,
				reply: "Provided user has not been found!"
			};
		}
	
		type = type.toLowerCase();
		switch (type) {
			case "cookie": {
				if (targetUserData.Name === context.platform.Self_Name) {
					return {
						reply: "I appreciate the gesture, but thanks, I don't eat sweets :)"
					};
				}
				else if (targetUserData === context.user) {
					return {
						reply: `Okay, so you gave the cookie to yourself...`
					};
				}

				const sourceUser = await sb.Query.getRow("chat_data", "Extra_User_Data");
				await sourceUser.load(context.user.ID, true);
				if (!sourceUser.loaded) {
					await sourceUser.save();
				}

				const targetUser = await sb.Query.getRow("chat_data", "Extra_User_Data");
				await targetUser.load(targetUserData.ID, true);
				if (!targetUser.loaded) {
					await targetUser.save();
				}
		
				if (sourceUser.values.Cookie_Today) {
					return {
						success: false,
						reply: "You already ate or gifted away your cookie today, so you can't gift it to someone else!"
					};
				}
				else if (sourceUser.values.Cookie_Is_Gifted) {
					return {
						success: false,
						reply: "That cookie was gifted to you! Eat it, don't give it away!"
					};
				}
				else if (!targetUser.values.Cookie_Today) {
					return {
						success: false,
						reply: "That user hasn't eaten their cookie today, so you would be wasting your gift! Get them to eat it!"
					};
				}
	
				sourceUser.setValues({
					Cookie_Today: true,
					Cookie_Gifts_Sent: sourceUser.values.Cookie_Gifts_Sent + 1
				});
	
				targetUser.setValues({
					Cookie_Today: false,
					Cookie_Is_Gifted: true,
					Cookie_Gifts_Received: targetUser.values.Cookie_Gifts_Received + 1
				});
	
				await Promise.all([
					sourceUser.save(),
					targetUser.save()
				]);
	
				sb.CooldownManager.unset(null, targetUser.ID, sb.Command.get("cookie").ID);
	
				return {
					reply: `Successfully given your cookie for today to ${targetUserData.Name} 🙂`
				};
			}
	
			default: return {
				success: false,
				reply: "Target type cannot be gifted (yet, at least)."
			};
		}
	}),
	Dynamic_Description: null
};