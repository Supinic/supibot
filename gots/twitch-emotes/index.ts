export default {
	name: "TwitchEmotes",
	optionsType: "object",
	options: {
		responseType: "json",
		throwHttpErrors: false,
		timeout: {
			request: 10_000
		},
		retry: {
			limit: 0
		},
	},
	parent: "GenericAPI",
	description: null
};
