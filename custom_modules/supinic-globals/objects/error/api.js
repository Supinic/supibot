module.exports = class APIError extends sb.Error {
	constructor (...args) {
		super(...args);
		this.type = "API";
	}

	static get name () { return "APIError"; }
};