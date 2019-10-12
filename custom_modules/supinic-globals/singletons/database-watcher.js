/* global sb */
module.exports = (function (Module) {
	const CronJob = require("cron").CronJob;

	return class DatabaseWatcher extends Module {
		/**
		 * @inheritDoc
		 * @returns {DatabaseWatcher}
		 */
		static async singleton() {
			if (!DatabaseWatcher.module) {
				DatabaseWatcher.module = await new DatabaseWatcher();
			}
			return DatabaseWatcher.module;
		}

		/**
		 * Creates a new Cooldown manager instance.
		 */
		constructor () {
			super();

			if (process.env.PROJECT_TYPE !== "bot") {
				return this;
			}

			this.ready = false;
			this.data = {};

			this.subscriptions = [];

			this.watches = [
				{
					data: [],
					name: "Suggestion",
					fetch: (rs) => rs.select("*").from("data", "Suggestion"),
					changed: (oldRow, newRow) => (oldRow && newRow && oldRow.Status !== newRow.Status),
					reply: async (subscriptions, oldRow, newRow) => {
						const sub = subscriptions.find(i => i.Event === "Suggestion" && i.User_Alias === newRow.User_Alias);
						if (!sub) {
							return;
						}

						const userData = await sb.User.get(sub.User_Alias, true);
						let reply = [
							userData.Name + ",",
							"Your suggestion (\"" + newRow.Text + "\") changed status:",
							oldRow.Status + " => " + newRow.Status
						];

						if (oldRow.Notes !== newRow.Notes) {
							reply.push("dev notes: " + newRow.Notes);
						}

						sb.Master.send(reply.join(" "), sub.Channel);
					}
				},
				{
					data: [],
					name: "Gachi",
					fetch: (rs) => rs.select("ID", "Name", "Author").from("data", "Gachi"),
					changed: (oldRow) => (!oldRow),
					reply: async (subscriptions, oldRow, newRow) => {
						const subs = subscriptions.filter(i => i.Event === "Gachi");
						if (subs.length === 0) {
							return;
						}

						let channelUsers = new Map();
						for (const sub of subs) {
							if (!channelUsers.has(sub.Channel)) {
								channelUsers.set(sub.Channel, []);
							}

							const userData = await sb.User.get(sub.User_Alias, true);
							channelUsers.get(sub.Channel).push(userData.Name);
						}

						for (const [channelID, users] of channelUsers) {
							const channelData = sb.Channel.get(channelID);
							const link = (channelData.Links_Allowed)
								? "supinic.com/gachi/detail/" + newRow.ID
								: "supinic website detail ID: " + newRow.ID;

							sb.Master.send(
								[
									"PagChomp 👉",
									users.join(", "),
									"New gachi has been added to the list!",
									link,
									newRow.Name + " by " + newRow.Author
								].join(" "),
								channelData
							);
						}
					}
				},
			];

			this.job = new CronJob(sb.Config.get("DATABASE_WATCHER_CRON_CONFIG"), () => this.check());
			this.job.start();

			return (async () => {
				for (const watch of this.watches) {
					watch.data = await sb.Query.getRecordset(watch.fetch);
				}

				this.subscriptions = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("chat_data", "Table_Update_Notification")
					.where("Active = %b", true)
				);

				this.ready = true;
				return this;
			})();
		}

		async check () {
			if (!this.ready || !sb.Master) {
				return;
			}

			for (const watch of this.watches) {
				const newData = await sb.Query.getRecordset(watch.fetch);

				for (const newRow of newData) {
					const oldRow = watch.data.find(i => i.ID === newRow.ID);
					if (watch.changed(oldRow, newRow)) {
						watch.reply(this.subscriptions, oldRow, newRow);
					}
				}

				watch.data = newData;
			}
		}

		async addOrToggle (userID, channelID, event) {
			event = sb.Utils.capitalize(event);
			const check = (await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("chat_data", "Table_Update_Notification")
				.where("User_Alias = %n", userID)
				.where("Event = %s", event)
			))[0];

			const row = await sb.Query.getRow("chat_data", "Table_Update_Notification");
			if (check) {
				await row.load(check.ID);

				const msg = "You are now unsubscribed from the event \"" + event + "\" in channel " + sb.Channel.get(row.values.Channel).Name;
				await row.delete();

				const index = this.subscriptions.findIndex(i => i.ID === check.ID);
				this.subscriptions.splice(index, 1);

				return msg;
			}
			else {
				row.setValues({
					User_Alias: userID,
					Channel: channelID,
					Event: event
				});

				await row.save();
				this.subscriptions.push(row.valuesObject);

				return "You are now subscribed to the event \"" + event + "\" in this channel.";
			}
		}

		get modulePath () { return "database-watcher"; }

		destroy () {
			this.data = null;
		}
	};
});