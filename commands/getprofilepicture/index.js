module.exports = {
	Name: "getprofilepicture",
	Aliases: ["avatar", "pfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given Twitch user, this command will fetch their profile picture.",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "banner", type: "boolean" },
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function profilePicture (context, username) {
		const login = sb.User.normalizeUsername(username ?? context.user.Name);
		const response = await sb.Got("Leppunen", {
			url: "v2/twitch/user",
			searchParams: {
				login
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not fetch profile picture! ${response.body.message}`
			};
		}
		else if (response.body.length === 0) {
			return {
				success: false,
				reply: `No such user found!`
			};
		}

		const [user] = response.body;
		if (context.params.banner === true) {
			if (user.banner === null) {
				return {
					success: false,
					reply: (context.params.linkOnly === true)
						? "N/A"
						: `User ${user.display_name} has no profile banner set up!`
				};
			}

			return {
				reply: (context.params.linkOnly === true)
					? user.banner
					: `Profile banner for ${user.display_name}: ${user.banner}`
			};
		}

		return {
			reply: (context.params.linkOnly)
				? user.profile_image_url
				: `Profile picture for ${user.display_name}: ${user.profile_image_url}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches a Twitch user's profile picture, or other pictures related to their account.",
		"",

		`<code>${prefix}getprofilepicture (user)</code>`,
		`<code>${prefix}avatar (user)</code>`,
		`<code>${prefix}pfp (user)</code>`,
		`<code>${prefix}pfp supinic</code>`,
		"Posts the user's profile picture.",
		"",

		`<code>${prefix}pfp <u>linkOnly:true</u> (user)</code>`,
		`<code>${prefix}pfp <u>linkOnly:true</u> @pajlada</code>`,
		"Post only the link to the picture, with no other text describing it.",
		"",

		`<code>${prefix}pfp <u>banner:true</u> (user)</code>`,
		`<code>${prefix}pfp <u>banner:true</u> @supinic</code>`,
		"Post the user's profile banner, if they have one set up. If they don't have one, a message describing that will appear instead.",
		"",
		`<code>${prefix}pfp <u>banner:true</u> <u>linkOnly:true</u> (user)</code>`,
		`<code>${prefix}pfp <u>banner:true</u> <u>linkOnly:true</u> @pajlada</code>`,
		`Post only the link to the user's profile banner. If they don't have one, the message "N/A" will show up.`
	])
};
