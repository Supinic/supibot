module.exports = {
	Name: "%",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Rolls a random percentage between 0 and 100%",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function percent () {
		const number = (sb.Utils.random(0, 10000) / 100);
		return { reply: `${number}%` };
	}),
	Dynamic_Description: (async (prefix) => [
		"Rolls a random percentage number between 0% and 100%.",
		"",
	
		`<code>${prefix}%</code>`,
		`${sb.Utils.random(0, 10000) / 100}%`
	])
};
