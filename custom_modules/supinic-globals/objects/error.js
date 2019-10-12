/* global sb */
module.exports = class Error extends global.Error {
	/**
	 * Custom error object - has arguments provided
	 * @param {*[]} obj
	 */
	constructor (obj, err) {
		if (!obj || obj.constructor !== Object) {
			throw new global.Error("sb.Error must receive an object as params");
		}

		const {message, args} = obj;
		super(message);

		this.name = obj.name || "sb.Error";
		this.date = new sb.Date();
		if (args) {
			this.message += "; args = " + JSON.stringify(args, null, 2);
		}
	}

	toString () {
		return this.description;
	}
};