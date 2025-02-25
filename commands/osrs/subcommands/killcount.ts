import { fetchUserData, parseUserIdentifier, getIronman } from "./osrs-utils.js";
import GameData from "../game-data.json" with { type: "json" };

import type User from "../../../classes/user.js";

// @todo Import from Command when done in Typescript
interface Context {
	user: User;
	params: {
		activity?: string;
		boss?: string;
		seasonal?: boolean;
		force?: boolean;
	};
}

const ActivityAlias = typeof GameData;
const isValidActivityAlias: (input: string): input is keyof typeof GameData.activityAliases => {

}

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
	execute: async function (context: Context, ...args: string[]) {
		const identifier = args.join(" ");
		const parsedUserData = await parseUserIdentifier(context, identifier);
		if (!parsedUserData.success) {
			return parsedUserData;
		}

		const user = parsedUserData.username;
		let activity;
		if (context.params.activity ?? context.params.boss) {
			activity = context.params.activity ?? context.params.boss;
		}
		if (!activity && parsedUserData.remainingArgs.length !== 0) {
			activity = parsedUserData.remainingArgs.join(" ");
		}

		if (!activity) {
			return {
				success: false,
				// @todo should be fixed when Command is in TS
				// @ts-ignore
				reply: `No activity provided! Use activity:"boss name" - for a list, check here: ${this.getDetailURL()}`
			};
		}

		const userStats = await fetchUserData(user, {
			seasonal: Boolean(context.params.seasonal),
			force: Boolean(context.params.force)
		});

		if (!userStats.success) {
			return userStats;
		}

		if (GameData.activityAliases.hasOwnProperty(activity)) {
			activity = GameData.activityAliases[activity as keyof GameData.activityAliases];
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
