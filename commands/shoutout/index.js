module.exports = {
	Name: "shoutout",
	Aliases: ["so"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Shouts out a given streamer (Twitch only), and posts the last game they played as well.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function shoutout (context, target) {
		if (!target) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}

		const twitchPlatform = sb.Platform.get("twitch");
		const userLookupResponse = await sb.Got("Helix", {
			url: "users",
			searchParams: {
				login: sb.User.normalizeUsername(target.trim())
			}
		});

		if (!Array.isArray(userLookupResponse.body.data)) {
			return {
				success: false,
				reply: `Your provided username is not valid!`
			};
		}

		const [helixUserData] = userLookupResponse.body.data;
		if (!helixUserData) {
			return {
				success: false,
				reply: "Cannot find that user on Twitch!"
			};
		}

		const targetUserID = helixUserData.id;
		if (targetUserID === context.user.Twitch_ID) {
			return {
				success: false,
				reply: "This isn't going to make you any more famous, you got to put the work in yourself!"
			};
		}
		else if (targetUserID === twitchPlatform.Self_ID) {
			return {
				reply: "Thanks for the effort, but I don't stream, so I suggest you use some of my commands instead to make me more famous 🙂"
			};
		}

		/*
			{
				broadcaster_id,
				broadcaster_language,
				broadcaster_login,
				broadcaster_name,
				delay,
				game_id,
				game_name,
				title
			}
			game_id and game_name and title is "" when never streamed before
			if delay is `null` the streamer is banned (?)
		 */
		const response = await sb.Got("Helix", {
			url: "channels",
			searchParams: {
				broadcaster_id: targetUserID
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `That user doesn't exist or has deactivated their account!`
			};
		}

		const {
			broadcaster_login: login,
			broadcaster_name: name,
			game_name: game,
			title,
			delay
		} = response.body.data[0];

		const url = `https://twitch.tv/${login}`;
		const nameString = (login.toLowerCase() === name.toLowerCase())
			? name
			: `${name} (${login})`;

		const bannedString = (delay === null) ? "They're likely banned! 🚨" : "";
		const titleString = (title) ? ` with title "${title}".` : ".";
		const gameString = (game)
			? `They last streamed in game/category ${game}${titleString}`
			: "";

		return {
			reply: sb.Utils.tag.trim `
				Shout out to ${nameString}!
				${gameString} 
				${bannedString}
				Check them out here: ${url}
			`
		};
	}),
	Dynamic_Description: null
};
