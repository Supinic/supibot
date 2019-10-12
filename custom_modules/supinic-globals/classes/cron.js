/* global sb */
module.exports = (function () {
	"use strict";

	const CronJob = require("cron").CronJob;

	/**
	 * Represents a function that's executed every some time
	 * @memberof sb
	 * @type Cron
	 */
	return class Cron {
		/**
		 * @param {Object} data
		 * @param {number} data.User_Alias
		 * @param {sb.Date} data.Started
		 * @param {string} data.Text
		 * @param {boolean} data.Silent
		 */
		constructor (data) {
			/**
			 * Unique numeric cron identifier
			 * @type {User.ID}
			 */
			this.ID = data.ID;

			/**
			 * Unique cron name
			 * @type {sb.Date}
			 */
			this.Name = data.Name;

			/**
			 * Cron expression that specifies when a job is being executed
			 * @type {string}
			 */
			this.Expression = data.Expression;

			/**
			 * Execution function of the cron job
			 * @type {Function}
			 */
			try {
				this.Code = eval(data.Code);
			}
			catch (e) {
				console.warn(`Cron ${data.Name} has invalid definition`, e);
				this.Code = () => {};
			}

			this.started = false;
			this.job = null;
		}

		/**
		 * Starts the cron job.
		 * @returns {Cron}
		 */
		start () {
			if (this.started) {
				return this;
			}

			if (!this.Expression) {
				console.error(`Cron ${this.Name} has no cron expression!`);
				return this;
			}

			this.job = new CronJob(this.Expression, this.Code);
			this.job.start();
			this.started = true;

			return this;
		}

		/**
		 * Stops the cron job.
		 * @returns {Cron}
		 */
		stop () {
			if (!this.started) {
				return this;
			}

			if (!this.job) {
				throw new sb.Error({
					message: `Job ${this.Name} has not been started yet!`
				});
			}

			this.job.stop();
			this.started = false;
			return this;
		}

		/** @override */
		static async initialize () {
			Cron.data = [];

			await Cron.loadData();
			return Cron;
		}

		static async loadData () {
			const types = ["All"];
			if (process.env.PROJECT_TYPE === "bot") {
				types.push("Bot");
			}
			else if (proecss.env.PROJECT_TYPE === "site") {
				types.push("Website");
			}

			Cron.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Cron")
				.where("Type IN %s+", types)
				.where("Active = %b", true)
			)).map(row => new Cron(row).start());
		}

		static async reloadData () {
			if (Cron.data.length > 0) {
				for (const cron of Cron.data) {
					if (cron.started) {
						cron.stop();
					}
				}
			}

			Cron.data = [];

			await Cron.loadData();
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			if (Cron.data && Cron.data.length > 0) {
				for (const cron of Cron.data) {
					if (cron.started) {
						cron.stop();
					}
				}
			}

			Cron.data = null;
		}
	};
})();