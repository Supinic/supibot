module.exports = {
	Name: "devnull",
	Aliases: ["/dev/null","null"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Discards all output. Only usable in pipes.",
	Flags: ["non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function devnull (context) {
		if (!context.append.pipe) {
			return {
				reply: "This command cannot be used outside of pipe!"
			};
		}
	
		return null;
	}),
	Dynamic_Description: null
};
