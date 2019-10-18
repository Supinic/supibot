/* global sb */
module.exports = (function () {
	"use strict";

	const Markov = require("markov-json").default;

	return class MarkovChain {
		#model = null;
		#prepared = false;

		/** @override */
		static async initialize () {
			MarkovChain.data = [];
			return MarkovChain;
		}

		static async reloadData () {
			MarkovChain.data = [];
		}

		/**
		 * Class containing markov chain data and simple ways to retrieve text out of them.
		 * @name sb.MarkovChain
		 * @type MarkovChain()
		 */
		constructor (data) {
			this.ID = data.ID;

			this.Name = data.Name;

			try {
				this.Definition = JSON.parse(data.Definition);
			}
			catch (e) {
				console.error("Markov chain model ID " + this.ID + " has invalid definition", e);
				this.Definition = null;
			}
		}

		sentences (amount = 1) {
			if (!this.#prepared) {
				this.load();
			}

			return this.#model.sentence(amount);
		}

		words (amount = 1) {
			if (!this.#prepared) {
				this.load();
			}

			return this.#model.words(amount);
		}

		train (data) {
			if (!this.#prepared) {
				this.load();
			}

			return this.#model.train(data);
		}

		load () {
			if (this.Definition === null) {
				throw new sb.Error({
					message: "Markov chain model ID " + this.ID + " has invalid definition. Cannot proceed"
				});
			}

			this.#model = new Markov(this.Definition);
			this.#prepared = true;
		}

		destroy () {
			for (const key of Object.keys(this.#model)) {
				this.#model[key] = null;
			}

			this.#model = null;
			this.#prepared = null;
		}

		get prepared () { return this.#prepared; }

		get model () { return this.#model; }

		static async get (identifier) {
			if (identifier instanceof MarkovChain) {
				return identifier;
			}
			else if (typeof identifier === "string") {
				let result = MarkovChain.data.find(i => i.Name === identifier);
				if (!result) {
					const data = await sb.Query.getRecordset(rs => rs
						.select("ID", "Name", "Definition")
						.from("data", "Markov_Chain")
						.where("Name = %s", identifier)
						.single()
					);

					if (data) {
						result = new MarkovChain(data);
						MarkovChain.data.push(result);
					}
				}

				return result;
			}
			else if (typeof identifier === "number") {
				let result = MarkovChain.data.find(i => i.ID === identifier);
				if (!result) {
					const data = await sb.Query.getRecordset(rs => rs
						.select("ID", "Name", "Definition")
						.from("data", "Markov_Chain")
						.where("ID = %n", identifier)
						.single()
					);

					if (data) {
						result = new MarkovChain(data);
						MarkovChain.data.push(result);
					}
				}

				return result;
			}
			else {
				throw new sb.Error({
					message: "Unrecognized identifier type",
					args: typeof identifier
				});
			}
		}
	};
})();