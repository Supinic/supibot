module.exports = {
	Name: "getprofilepicture",
	Aliases: ["avatar", "pfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given Twitch user, this command will fetch their profile picture.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function profilePicture (context, username) {
		const login = sb.User.normalizeUsername(username ?? context.user.Name);
		const response = await sb.Got("Helix", {
			url: "users",
			searchParams: { login },
			throwHttpErrors: false
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not fetch profile picture! ${response.body.message}`
			};
		}
		else if (response.body.data.length === 0) {
			return {
				success: false,
				reply: `No such user found on Twitch!`
			};
		}

		const [user] = response.body.data;
		return {
			reply: (context.params.linkOnly)
				? user.profile_image_url
				: `Profile picture for ${user.display_name}: ${user.profile_image_url}`
		};
	}),
	Dynamic_Description: null
};
