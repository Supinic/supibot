export default {
	name: "RaspberryPi4",
	optionsType: "object",
	options: {
		prefixUrl: "http://192.168.1.102:11111/proxy",
		timeout: {
			request: 10000
		}
	},
	parent: "GenericAPI",
	description: null
};
