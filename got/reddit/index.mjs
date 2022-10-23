export default {
	name: "Reddit",
	optionsType: "object",
	options: {
		prefixUrl: "https://www.reddit.com/r/",
		headers: {
			Cookie: "_options={%22pref_quarantine_optin%22:true,%22pref_gated_sr_optin%22:true};"
		}
	},
	parent: "Global",
	description: null
};
