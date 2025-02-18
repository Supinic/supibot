import { fetchUserData, parseUserIdentifier, getIronman } from "./osrs-utils.js";
import GameData from "../game-data.json" with { type: "json" };

export default {
	name: "stats",
	title: "Skill levels",
	aliases: [],
	default: true,
	description: [
		"Skill level overview",
		`<code>$osrs (username)</code>`,
		`<code>$osrs stats (username)</code>`,
		`<code>$osrs stats (username) force:true</code>`,
		"Posts a full list of skill levels for provided user. Does not include experience or rankings.",
		"Results are cached. If you would like to force a new user reload, use the <code>force:true</code> parameter.",
		"",

		"Skill level detail",
		`<code>$osrs (username) skill:(skill)</code>`,
		`<code>$osrs stats (username) skill:(skill)</code>`,
		"For given user, posts the skill's level, experience, and ranking.",
		`If used with "seasonal-stats", the command will attempt to use that user's seasonal profile.`,
		"",

		"Virtual levels",
		`<code>$osrs (username) skill:(skill) virtual:true</code>`,
		`<code>$osrs (username) virtual:true</code>`,
		"Will take into account virtual levels."
	],
	execute: async function (context, ...args) {
		const identifier = args.join(" ");
		const parsedUserData = await parseUserIdentifier(context, identifier);
		if (!parsedUserData.success) {
			return parsedUserData;
		}

		const user = parsedUserData.username;
		const userStats = await fetchUserData(user, {
			seasonal: Boolean(context.params.seasonal),
			force: Boolean(context.params.force)
		});

		if (userStats.success === false) {
			return userStats;
		}

		const { data } = userStats;
		const accountType = (context.params.seasonal)
			? "seasonal user"
			: getIronman(data, Boolean(context.params.rude));

		if (context.params.skill) {
			const skillName = context.params.skill.toLowerCase();
			const skillData = GameData.skills.find(i => i.name === skillName || i.aliases?.includes(skillName));
			if (!skillData) {
				return {
					success: false,
					reply: "No valid skill matching your query has been found!"
				};
			}

			const { name, emoji } = skillData;
			const skill = data.skills.find(i => i.name.toLowerCase() === name);
			if (!skill) {
				return {
					success: false,
					reply: `That skill does not exist!`
				};
			}
			else if (skill.level === null) {
				return {
					success: false,
					reply: `That ${accountType}'s ${context.params.skill.toLowerCase()} is not high enough level to appear on the highscores!`
				};
			}

			const experience = (skill.experience === -1)
				? "(unranked)"
				: sb.Utils.groupDigits(skill.experience);

			const level = (context.params.virtual) ? skill.virtualLevel : skill.level;
			return {
				reply: sb.Utils.tag.trim `
					${sb.Utils.capitalize(accountType)} ${user}
					${emoji} ${level} 
					(XP: ${experience})
				`
			};
		}

		const strings = [];
		for (const { emoji, name } of GameData.skills) {
			const found = data.skills.find(i => i.name.toLowerCase() === name.toLowerCase());
			if (found && found.level !== null) {
				const level = (context.params.virtual)
					? (found.virtualLevel ?? found.level)
					: found.level;

				strings.push(`${emoji} ${level}`);
			}
		}

		if (strings.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(accountType)} ${user} exists, but none of their stats are being tracked.`
			};
		}
		else {
			const total = data.skills.find(i => i.name.toLowerCase() === "overall");
			const totalXPString = (total)
				? `XP: ${sb.Utils.groupDigits(total.experience)}`
				: "";

			const combatLevelString = (data.combatLevel !== null)
				? `Combat level: ${data.combatLevel}`
				: "";

			return {
				reply: sb.Utils.tag.trim `
					Stats for ${accountType} ${user}:
					${strings.join(" ")}
					|
					${totalXPString}
					|
					${combatLevelString}
				`
			};
		}
	}
};
