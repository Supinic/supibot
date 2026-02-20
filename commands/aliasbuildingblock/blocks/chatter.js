const BASE_CACHE_KEY = "abb-chatter";
const getCooldownKey = (userData, channelData) => `${BASE_CACHE_KEY}-${userData.ID}-${channelData.ID}`;

export default {
	name: "chatter",
	aliases: [],
	description: "Selects a random chatter within the channel, and outputs their name. Not applicable in PMs. Use the \"excludeSelf:true\" parameter to exclude yourself from the random chatter roll. If you would rather not appear in the results, use the \"$set no-abb-chatter\" command.",
	examples: [
		["$abb chatter", "(user)"], ["$abb chatter excludeSelf:true", "(someone who is not you)"]
	],
	execute: async (context) => {
		if (context.privateMessage) {
			return {
				success: false,
				reply: "There is nobody else here 😨"
			};
		}
		else if (typeof context.channel.fetchUserList !== "function") {
			return {
				success: false,
				reply: "This has not been implemented here... yet! 4Head"
			};
		}

		const cacheKey = getCooldownKey(context.user, context.channel);
		const cooldownKeyExists = await core.Cache.getByPrefix(cacheKey);
		if (cooldownKeyExists) {
			return {
				success: false,
				reply: "Currently on cooldown!"
			};
		}

		const eligibleUsernames = await context.channel.fetchUserList();
		const botIndex = eligibleUsernames.findIndex(i => i.toLowerCase() === context.platform.Self_Name);
		if (botIndex !== -1) {
			eligibleUsernames.splice(botIndex, 1);
		}

		const exemptUsernames = await core.Query.getRecordset(rs => rs
			.select("User_Alias.Name AS Username")
			.from("chat_data", "User_Alias_Data")
			.join("chat_data", "User_Alias")
			.where("Property = %s", "noAbbChatter")
			.flat("Username")
		);

		const usernames = eligibleUsernames.filter(i => !exemptUsernames.includes(i));
		if (context.params.excludeSelf) {
			const index = usernames.findIndex(i => i.toLowerCase() === context.user.Name);
			if (index !== -1) {
				usernames.splice(index, 1);
			}

			if (usernames.length === 0) {
				return {
					success: false,
					reply: `No users fetched! Platform provided me with no users, please try again later.`
				};
			}
		}

		// "Mask" the outages in chatter-list APIs across platforms by "pretending" to roll the user executing the command.
		if (usernames.length === 0) {
			return {
				reply: context.user.Name
			};
		}

		await core.Cache.setByPrefix(cacheKey, true, {
			expiry: 10_000
		});

		return {
			reply: core.Utils.randArray(usernames)
		};
	}
};
