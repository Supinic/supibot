const OsrsUtils = require("./osrs-utils.js");
const GameData = require("../game-data.json");

module.exports = {
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
		const user = args.join(" ");
		if (!user) {
			return {
				success: false,
				reply: `No player name provided!`
			};
		}

		const userStats = await OsrsUtils.fetch(user, {
			seasonal: Boolean(context.params.seasonal),
			force: Boolean(context.params.force)
		});

		if (userStats.success === false) {
			return userStats;
		}

		const accountType = (context.params.seasonal)
			? "seasonal user"
			: OsrsUtils.getIronman(userStats, Boolean(context.params.rude));

		if (context.params.skill) {
			const skillName = context.params.skill.toLowerCase();
			const skillData = GameData.skills.find(i => i.name === skillName || i.aliases.includes(skillName));
			if (!skillData) {
				return {
					success: false,
					reply: "No valid skill matching your query has been found!"
				};
			}

			const { name, emoji } = skillData;
			const skill = userStats.skills.find(i => i.name.toLowerCase() === name);
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
			const found = userStats.skills.find(i => i.name.toLowerCase() === name.toLowerCase());
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
			const total = userStats.skills.find(i => i.name.toLowerCase() === "overall");
			const totalXPString = (total)
				? `XP: ${sb.Utils.groupDigits(total.experience)}`
				: "";

			const combatLevelString = (userStats.combatLevel !== null)
				? `Combat level: ${userStats.combatLevel}`
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
