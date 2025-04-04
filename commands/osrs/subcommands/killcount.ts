import {
	fetchUserData,
	parseUserIdentifier,
	getIronman,
	getActivityFromAlias,
	isValidActivityAlias
} from "./osrs-utils.js";

import SetCommand from "../../set/subcommands/osrs-username.js";

import type User from "../../../classes/user.js";

// @todo Import from Command when done in Typescript
type Context = {
	user: User;
	params: {
		activity?: string;
		boss?: string;
		seasonal?: boolean;
		force?: boolean;
		rude?: boolean;
	};
};

export default {
	name: "kc",
	title: "Kill count",
	aliases: ["kill-count"],
	description: [
		`<code>$osrs kc activity:"(activity name)" (username)</code>`,
		`<code>$osrs kill-count activity:"(activity name)" (username)</code>`,
		`<code>$osrs kc boss:"(activity name)" (username)</code>`,
		"For given user and activity, prints their kill-count and ranking.",
		"",

		`<code>$osrs kc (activity)</code>`,
		`<code>$osrs kc jad</code>`,
		`If you have set up your username via the <code>$set ${SetCommand.name}</code>, you can use the name of the activity directly!`,
		"",

		`<code>$osrs kc @Username (activity)</code>`,
		`<code>$osrs kc @Supinic Corrupted Gauntlet</code>`,
		"Same as above, but if the target has their OSRS username set, you can use the command like this."
	],
	execute: async function (/* @todo add this: Command */ context: Context, ...args: string[]) {
		let parsedUserData;
		let activity;
		if (!context.params.activity && !context.params.boss) {
			if (args[0].startsWith("@")) {
				parsedUserData = await parseUserIdentifier(context, args[0]);
				activity = args.slice(1).join(" ");
			}
			else {
				parsedUserData = await parseUserIdentifier(context, "");
				activity = args.join(" ");
			}
		}
		else {
			const identifier = args.join(" ");
			parsedUserData = await parseUserIdentifier(context, identifier);
			activity = context.params.activity ?? context.params.boss;
		}

		if (!parsedUserData.success) {
			return parsedUserData;
		}
		else if (!activity) {
			return {
				success: false,
				// @todo should be fixed when Command is in TS
				// @ts-ignore
				reply: `No activity provided! Use activity:"boss name" - for a list, check here: ${this.getDetailURL()}`
			};
		}

		const { username } = parsedUserData;
		const userStats = await fetchUserData(username, {
			seasonal: Boolean(context.params.seasonal),
			force: Boolean(context.params.force)
		});

		if (!userStats.success) {
			return userStats;
		}

		if (isValidActivityAlias(activity)) {
			activity = getActivityFromAlias(activity);
		}

		const { data } = userStats;
		const activities = data.activities.map(i => i.name.toLowerCase());
		const bestMatch = sb.Utils.selectClosestString(activity.toLowerCase(), activities, { ignoreCase: true })
		if (!bestMatch) {
			return {
				success: false,
				// @todo should be fixed when Command is in TS
				// @ts-ignore
				reply: `Invalid activity was not found! Check the list here: ${this.getDetailURL()}`
			};
		}

		const bestActivity = data.activities.find(i => i.name.toLowerCase() === bestMatch.toLowerCase());
		if (!bestActivity) {
			throw new Error("Assert: Activity not found"); //@todo change to SupiError
		}

		const { name, rank, value } = bestActivity
		const ironman = (context.params.seasonal)
			? "Seasonal user"
			: sb.Utils.capitalize(getIronman(data, Boolean(context.params.rude)));

		return {
			reply: (rank === null)
				? `${ironman} ${username} is not ranked for ${name}.`
				: `${ironman} ${username}'s KC for ${name}: ${value} - rank #${rank}.`
		};
	}
};
