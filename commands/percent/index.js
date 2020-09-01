module.exports = {
	Name: "%",
	Aliases: null,
	Cooldown: 5000,
	Description: "Rolls a random percentage between 0 and 100%",
	Flags: ["mention","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Source: "supinic",
	Static_Data: null,
	Code: (async function percent () {
		const number = (sb.Utils.random(0, 10000) / 100);
		return { reply: number + "%" };
	})
};