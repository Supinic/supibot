export const definition = {
	name: "RaspberryPi4",
	optionsType: "object",
	options: {
		prefixUrl: "http://localhost:11111/proxy",
		timeout: {
			request: 10000
		}
	},
	parent: "GenericAPI",
	description: null
};
