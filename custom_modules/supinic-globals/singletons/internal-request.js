/* global sb */
module.exports = (function (Module) {
	if (!process.env.PROJECT_TYPE) {
		return class Empty {
			static singleton () { return Empty; }
		};
	}

	const http = require("http");
	const url = require("url");

	return class InternalRequest extends Module {
		/**
		 * @inheritDoc
		 * @returns {InternalRequest}
		 */
		static async singleton() {
			if (!InternalRequest.module) {
				InternalRequest.module = await new InternalRequest();
			}
			return InternalRequest.module;
		}

		constructor () {
			super();

			this.data = {};
			this.pending = {};
			this.server = http.createServer((req, res) => {
				if (process.env.PROJECT_TYPE === "bot") {
					this.processBotRequest(req, res);
				}
				else {
					this.processSiteRequest(req, res);
				}
			});

			this.server.listen(sb.Config.get("INTERNAL_REQUEST_PORT_" + process.env.PROJECT_TYPE.toUpperCase()));

			if (process.env.PROJECT_TYPE === "bot") {
				this.subscriptions = [];

				return (async () => {
					this.subscriptions = await sb.Query.getRecordset(rs => rs
						.select("*")
						.from("chat_data", "Table_Update_Notification")
						.where("Active = %b", true)
					);
					return this;
				})();
			}
			else if (process.env.PROJECT_TYPE === "site") {
				return this;
			}
		}

		async processBotRequest (req, res) {
			const query = url.parse(req.url,true).query;
			console.log("INCOMING INTERNAL REQUEST FROM WEBSITE!!!", query, req, res);

			if (query.type === "watch" && query.table === "Gachi") {
				const subs = this.subscriptions.filter(i => i.Event === "Gachi");
				if (subs.length === 0) {
					return;
				}

				const track = await sb.Query.getRow("data", "Gachi");
				await track.load(Number(query.ID));

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
						? "https://supinic.com/gachi/detail/" + track.values.ID
						: "supinic website detail ID: " + track.values.ID;

					let msg = [
						"PagChomp",
						users.map(user => "@" + user).join(", "),
						"!!",
						"New gachi has been added to the list!",
						link,
						track.values.Name + " by " + track.values.Author
					].join(" ");

					msg = await sb.Master.prepareMessage(msg, channelData);

					sb.Master.send(msg, channelData);
				}
			}
			else if (query.type === "paypal") {
				sb.Master.send(
					"Someone just donated " + query.currency + " " + query.amount + " PagChomp",
					"supinic"
				);

				if (query.id === "WH-2WR32451HC0233532-67976317FL4543714") {
					sb.Master.send(
						"But unforunately, this is just a jebait because I'm testing it with non-existing money Jebaited Clap",
						"supinic"
					);
				}
			}
			else if (query.type === "follow") {
				const userData = await sb.User.get(query.username, true);
				if (userData.Following) {
					return;
				}

				await sb.Query.raw(`
					INSERT INTO chat_data.Extra_User_Data 
					(User_Alias, Following, Follow_Date)
					VALUES
					(${userData.ID}, 1, '${new sb.Date().sqlDateTime()}')
					ON DUPLICATE KEY UPDATE Following = 1, Follow_Date = '${new sb.Date().sqlDateTime()}'
				`);

				sb.Master.send(query.username + " just followed the channel PagChomp !! Thank you supiniOkay", "supinic");
			}
			else if (query.type === "reload") {
				if (query.module === "afk") {
					await sb.AwayFromKeyboard.reloadData();
				}
				else if (query.module === "reminder") {
					await sb.Reminder.reloadData();
				}
				else {
					throw new sb.Error({
						message: "Unrecognized module",
						args: query.module
					});
				}
			}
			else if (query.type === "queue") {
				const params = new sb.URLParams().set("type", "queue");
				await this.send(params, {
					current: await sb.VideoLANConnector.currentlyPlayingData(),
					queue: sb.VideoLANConnector.videoQueue
				});
			}

			res.end("OK");
		}

		async processSiteRequest (req, res) {
			const query = url.parse(req.url,true).query;
			if (query.type === "queue") {
				const data = [];

				req.on("data", chunk => data.push(chunk));
				req.on("end", () => {
					if (this.pending.queue instanceof sb.Promise) {
						this.pending.queue.resolve(JSON.parse(data));
					}
				});
			}

			res.end("OK");
		}

		async send (urlParams = "", data) {
			if (urlParams && !(urlParams instanceof sb.URLParams)) {
				throw new sb.Error("URL Params must be sb.URLParams if used");
			}

			const targetPort = (process.env.PROJECT_TYPE === "bot")
				? sb.Config.get("INTERNAL_REQUEST_PORT_SITE")
				: sb.Config.get("INTERNAL_REQUEST_PORT_BOT");

			const requestObject = {
				method: "POST",
				uri: "http://localhost:" + targetPort + "/?" + urlParams.toString()
			};

			if (data) {
				requestObject.json = data;
			}

			sb.Utils.request(requestObject);
		}

		addSubscription (valuesObject) {
			this.subscriptions.push(valuesObject);
		}

		removeSubscription (ID) {
			const index = this.subscriptions.findIndex(i => i.ID === ID);
			if (index !== -1) {
				this.subscriptions.splice(index, 1);
			}
		}
		get modulePath () { return "internal-request"; }

		destroy () {
			this.data = null;
		}
	};
});