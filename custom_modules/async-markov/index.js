module.exports = (function () {
	const waitImmediate = () => new globalThis.Promise((resolve) => (
		setImmediate(() => resolve())
	));

	return class AsyncMarkov {
		#words = {};
		#hasSentences = false;
		#busy = false;
		#prepared = false;

		async process (string) {
			if (this.#busy) {
				return;
			}

			this.#busy = true;

			if (!this.#hasSentences) {
				this.#hasSentences = (string.indexOf("?") !== -1 || string.indexOf("!") !== -1 || string.indexOf(".") !== -1);
			}

			const data = string.replace(/[^\w\d ]/g, "").replace(/\s+/g, " ").split(" ");
			const length = data.length;

			for (let i = 0; i < length; i++) {
				const first = data[i];
				const second = data[i + 1];

				if (typeof this.#words[first] === "undefined") {
					this.#words[first] = {
						total: 1,
						related: {},
						mapped: null
					};
				}
				else {
					this.#words[first].total++;
				}

				if (typeof this.#words[first].related[second] === "undefined") {
					this.#words[first].related[second] = 1;
				}
				else {
					this.#words[first].related[second]++;
				}

				await waitImmediate();
			}

			this.#busy = false;
			this.#prepared = true;

			return this;
		}

		word (root) {
			if (!this.#prepared) {
				throw new Error("Cannot generate words, model has no processed data");
			}

			if (!root) {
				const keys = Object.keys(this.#words);
				const index = Math.trunc(Math.random() * keys.length);
				root = keys[index];
			}

			const object = this.#words[root];
			return AsyncMarkov.weightedPick(object);
		}

		words (amount, root = null) {
			if (amount <= 0 || Math.trunc(amount) !== amount || !Number.isFinite(amount)) {
				throw new Error("Input amount must be a positive finite integer");
			}

			let current = root;
			const output = [];
			if (current) {
				output.push(current);
			}

			while (amount--) {
				current = this.word(current);
				output.push(current);
			}

			return output.join(" ");
		}

		sentences (amount, root = null) {
			if (!this.#hasSentences) {
				throw new Error("Model data has no sentences - cannot re-create");
			}
			else if (amount <= 0 || Math.trunc(amount) !== amount || !Number.isFinite(amount)) {
				throw new Error("Amount of setence must be a positive finite integer");
			}

			let current = root;
			const output = [];
			if (current) {
				output.push(current);
			}

			while (amount >= 0) {
				current = this.word(current);
				output.push(current);

				if (current.indexOf("?") !== -1 || current.indexOf("!") !== -1 || current.indexOf(".") !== -1) {
					amount--;
				}
			}

			return output.join(" ");
		}

		get size () { return Object.keys(this.#words).length; }
		get busy () { return this.#busy; }
		get prepared () { return this.#prepared; }

		static weightedPick (object) {
			if (!object.mapped) {
				let total = 0;
				object.mapped = {};

				const keys = Object.keys(object.related);
				const length = keys.length;
				for (let i = 0; i < length; i++) {
					const key = keys[i];
					const value = object.related[key];

					total += value;
					object.mapped[total] = key;
				}
			}

			const roll = Math.trunc(Math.random() * object.total);

			for (const pick of Object.keys(object.mapped)) {
				if (roll < pick) {
					return object.mapped[pick];
				}
			}

			return null;
		}
	};
})();