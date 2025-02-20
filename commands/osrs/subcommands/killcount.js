import { fetchUserData, parseUserIdentifier, getIronman } from "./osrs-utils.js";
import GameData from "../game-data.json" with { type: "json" };

export default {
	name: "kc",
	title: "Kill count",
	aliases: ["kill-count"],
	description: [
		`<code>$osrs kc activity:"(activity name)" (username)</code>`,
		`<code>$osrs kill-count activity:"(activity name)" (username)</code>`,
		`<code>$osrs kc boss:"(activity name)" (username)</code>`,
		"For given user and activity, prints their kill-count and ranking."
	],
	execute: async function (context, ...args) {
		const identifier = args.join(" ");
		const parsedUserData = await parseUserIdentifier(context, identifier);
		if (!parsedUserData.success) {
			return parsedUserData;
		}

		const user = parsedUserData.username;
		let activity = context.params.activity ?? context.params.boss;
		if (!activity) {
			return {
				success: false,
				reply: `No activity provided! Use activity:"boss name" - for a list, check here: ${this.getDetailURL()}`
			};
		}

		const userStats = await fetchUserData(user, {
			seasonal: Boolean(context.params.seasonal),
			force: Boolean(context.params.force)
		});

		if (userStats.success === false) {
			return userStats;
		}

		if (GameData.activityAliases[activity.toLowerCase()]) {
			activity = GameData.activityAliases[activity.toLowerCase()];
		}

		const { data } = userStats;
		const activities = data.activities.map(i => i.name.toLowerCase());
		const bestMatch = sb.Utils.selectClosestString(activity.toLowerCase(), activities, { ignoreCase: true });
		if (!bestMatch) {
			return {
				success: false,
				reply: `Invalid activity was not found! Check the list here: ${this.getDetailURL()}`
			};
		}

		const { name, rank, value } = data.activities.find(i => i.name.toLowerCase() === bestMatch.toLowerCase());
		const ironman = (context.params.seasonal)
			? "Seasonal user"
			: sb.Utils.capitalize(getIronman(data, Boolean(context.params.rude)));

		return {
			reply: (rank === null)
				? `${ironman} ${user} is not ranked for ${name}.`
				: `${ironman} ${user}'s KC for ${name}: ${value} - rank #${rank}.`
		};
	}
};
