export default {
	Name: "getprofilepicture",
	Aliases: ["avatar", "pfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given Twitch user, this command will fetch their profile picture.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "banner", type: "boolean" },
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function profilePicture (context, username) {
		const login = sb.User.normalizeUsername(username ?? context.user.Name);
		const response = await sb.Got.get("IVR")({
			url: "v2/twitch/user",
			searchParams: {
				login
			}
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Could not fetch profile picture! ${response.body.message}`
			};
		}
		else if (!Array.isArray(response.body)) {
			// 2023-03-25: Super sanity check, IVR API maybe(?) sometimes returns a non-Array response for the `user` endpoint
			const logId = await sb.Logger.log(
				"Command.Fail",
				`IVR API returned non-array: ${JSON.stringify(response.body)}`,
				context.channel,
				context.user
			);

			throw new sb.Error({
				message: `Invalid IVR API response - more data: Log #${logId}`
			});
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
						: `User ${user.displayName} has no profile banner set up!`
				};
			}

			return {
				reply: (context.params.linkOnly === true)
					? user.banner
					: `Profile banner for ${user.displayName}: ${user.banner}`
			};
		}

		return {
			reply: (context.params.linkOnly)
				? user.logo
				: `Profile picture for ${user.displayName}: ${user.logo}`
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
