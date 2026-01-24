import { declare } from "../../classes/command.js";
import type TwitchPlatform from "../../platforms/twitch.js";
import { twitchChannelSchema } from "../../utils/schemas.js";

export default declare({
	Name: "shoutout",
	Aliases: ["so"],
	Cooldown: 30000,
	Description: "Shouts out a given streamer (Twitch only), and posts the last game they played as well.",
	Flags: ["mention"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function shoutout (context, target) {
		if (context.platform.name !== "twitch") {
			return {
				success: false,
				reply: "This command is only usable on Twitch!"
			};
		}
		if (!target) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}

		// @todo remove typecast when platform is discriminated by name
		const platform = context.platform as TwitchPlatform;
		const cleanUsername = sb.User.normalizeUsername(target.trim());

		const targetUserId = await platform.getUserID(cleanUsername);
		if (targetUserId === context.user.Twitch_ID) {
			return {
				success: false,
				reply: "This isn't going to make you any more famous, you got to put the work in yourself!"
			};
		}
		else if (targetUserId === platform.selfId) {
			return {
				success: false,
				reply: "Thanks for the effort, but I don't stream! I suggest you use some of my commands instead to make me more popular 🙂"
			};
		}

		const response = await core.Got.get("Helix")({
			url: "channels",
			searchParams: {
				broadcaster_id: targetUserId
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
			title
		} = twitchChannelSchema.parse(response.body)[0];

		const url = `https://twitch.tv/${login}`;
		const nameString = (login.toLowerCase() === name.toLowerCase()) ? name : `${name} (${login})`;
		const titleString = (title) ? ` with title "${title}".` : ".";
		const gameString = (game) ? `They last streamed in game/category ${game}${titleString}` : "";

		return {
			success: true,
			reply: `Shout out to ${nameString}! ${gameString} Check them out here: ${url}`
		};
	}),
	Dynamic_Description: null
});
