export default {
	name: "Speedrun",
	optionsType: "object",
	options: {
		prefixUrl: "https://www.speedrun.com/api/v1",
		timeout: {
			request: 30000
		}
	},
	parent: "GenericAPI",
	description: null
};
