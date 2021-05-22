module.exports = {
	Name: "supibotupdates",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Toggles your role on Supinic's discord which determines if you get pinged by the #supibot-updates announcements.",
	Flags: ["ping"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		updatesRoleID: "748957148439904336",
		supinicGuildID: "633342787869212683"
	})),
	Code: (async function supibotUpdate (context) {
		if (context.platform.Name !== "discord") {
			return {
				success: false,
				reply: "This command can only be invoked on Discord!"
			};
		}

		const { guild, member } = context.append;
		if (!guild || guild.id !== this.staticData.supinicGuildID) {
			return {
				success: false,
				reply: "This command can only be invoked in Supinic's discord server!"
			};
		}

		const role = guild.roles.cache.get(this.staticData.updatesRoleID);
		if (!role) {
			return {
				success: false,
				reply: "Supinic has deleted this role PepeLaugh"
			};
		}

		const hasRole = member.roles.cache.has(role.id);
		if (hasRole) {
			member.roles.remove(role, `Bot unassigned role on ${sb.Date.now()} in channel ${context.channel?.ID ?? null}.`);
		}
		else {
			member.roles.add(role, `Bot assigned the role on ${sb.Date.now()} in channel ${context.channel?.ID ?? null}.`);
		}

		const [string, emoji] = (hasRole) ? ["no longer", "😊"] : ["", "☹"];
		return {
			reply: `You now ${string} have the role that mentions you for Supibot updates ${emoji}`
		};
	}),
	Dynamic_Description: null
};
