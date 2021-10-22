export default {
	name: "Vimeo",
	optionsType: "function",
	options: (() => ({
		prefixUrl: "https://api.vimeo.com",
		headers: {
			Authorization: `Bearer ${sb.Config.get("VIMEO_API_KEY")}`
		}
	})),
	parent: "Global",
	description: null
};
