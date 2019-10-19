module.exports = class Promise extends global.Promise {
	#resolve = null;
	#reject = null;

	constructor (handler) {
		let instanceResolve = null;
		let instanceReject = null;

		super((resolve, reject) => {
			if (handler) {
				handler(resolve, reject);
			}

			instanceResolve = resolve;
			instanceReject = reject;
		});

		this.#resolve = instanceResolve;
		this.#reject = instanceReject;
	}

	resolve (value) {
		this.#resolve(value);
		return this;
	}

	reject (value) {
		this.#reject(value);
		return this;
	}
};