const DISCORD_UPDATES_ROLE_ID = "748957148439904336";
const SUPINIC_DISCORD_GUILD_ID = "633342787869212683";

export default {
	Name: "supibotupdates",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Toggles your role on Supinic's discord which determines if you get pinged by the #supibot-updates announcements.",
	Flags: ["ping"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function supibotUpdate (context) {
		if (context.platform.Name !== "discord") {
			return {
				success: false,
				reply: "This command can only be invoked on Discord!"
			};
		}

		const messageData = context.platformSpecificData;
		if (!messageData || !messageData.guild || !messageData.member) {
			throw new sb.Error({
				message: "Assert error: No guild/member available on Discord platform"
			});
		}

		const { guild, member } = messageData;
		if (!guild || guild.id !== SUPINIC_DISCORD_GUILD_ID) {
			return {
				success: false,
				reply: "This command can only be invoked in Supinic's discord server!"
			};
		}

		const role = guild.roles.cache.get(DISCORD_UPDATES_ROLE_ID);
		if (!role) {
			return {
				success: false,
				reply: "Supinic has deleted this role PepeLaugh"
			};
		}

		const hasRole = member.roles.cache.has(role.id);
		if (hasRole) {
			await member.roles.remove(role, `Bot unassigned role on ${sb.Date.now()} in channel ${context.channel?.ID ?? null}.`);
		}
		else {
			await member.roles.add(role, `Bot assigned the role on ${sb.Date.now()} in channel ${context.channel?.ID ?? null}.`);
		}

		const [string, emoji] = (hasRole) ? ["no longer", "☹"] : ["", "😊"];
		return {
			reply: `You now ${string} have the role that mentions you for Supibot updates ${emoji}`
		};
	}),
	Dynamic_Description: null
};
