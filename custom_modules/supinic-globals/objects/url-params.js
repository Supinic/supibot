/**
 * Class to handle URL params, basically an extension of Map.
 * @memberof sb
 * @namespace URLParams
 */
module.exports = class URLParams {
	#char = "+";
	#values = [];

	constructor (joinCharacter = "+") {
		this.#char = joinCharacter;
	}

	set (key, value) {
		this.#values.push([key, value]);
		return this;
	}

	unset (keyToUnset) {
		this.#values = this.#values.filter(([key]) => key !== keyToUnset);
		return this;
	}

	clear () {
		this.#values = [];
		return this;
	}

	has (keyToCheck) {
		return this.#values.some(([key]) => key === keyToCheck);
	}

	toString () {
		return this.#values.map(([key, value]) => (
			key + "=" + String(value).split(" ").map(i => encodeURIComponent(i)).join(this.#char)
		)).join("&");
	}

	toJSON () {
		return JSON.stringify(this.#values);
	}
};