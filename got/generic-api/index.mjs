export default {
	name: "GenericAPI",
	optionsType: "function",
	options: ((sb) => ({
		mutableDefaults: true,
		throwHttpErrors: true,
		hooks: {
			beforeError: [
				(e) => new sb.errors.GenericRequestError({
					body: e.response?.body ?? null,
					statusCode: e.response?.statusCode,
					statusMessage: e.response?.statusMessage,
					hostname: e.options?.url?.hostname,
					message: e.message,
					stack: e.stack
				})
			]
		}
	})),
	parent: "Global",
	description: null
};
